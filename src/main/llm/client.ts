import OpenAI from 'openai'
import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici'
import { zodTextFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import pLimit from 'p-limit'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { llmCalls } from '../db/schema'
import type { SettingsService } from '../services/settings'
import type { Llm, LlmRequest } from './types'
import { promptFor } from './prompts'
import { FakeLlm } from './fake'
import type { LlmStatus } from '../../shared/domain'
export class OpenAiLlm implements Llm {
  private proxy = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'].some((name) =>
    Boolean(process.env[name]),
  )
    ? new EnvHttpProxyAgent()
    : undefined
  constructor(
    private settings: SettingsService,
    private db: Db,
    private clock: () => Date,
  ) {}
  available() {
    const s = this.settings.get()
    return this.settings.publicGet().apiKeySet && Boolean(s.modelGenerate && s.modelVerify)
  }
  async complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
    const s = this.settings.get()
    const model = ['generate', 'diagnose', 'suggest-edges'].includes(request.purpose)
      ? s.modelGenerate
      : s.modelVerify
    const key = this.settings.apiKey()
    if (!key || !model) throw new Error('Configura una clave API y ambos modelos en Ajustes.')
    const client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.openai.com/v1',
      maxRetries: 0,
      timeout: 20000,
      ...(this.proxy
        ? {
            // SDK URL requests use the documented Undici adapter; DOM/Undici Request declarations differ.
            fetch: proxyFetch as unknown as NonNullable<
              NonNullable<ConstructorParameters<typeof OpenAI>[0]>['fetch']
            >,
            fetchOptions: { dispatcher: this.proxy },
          }
        : {}),
    })
    const prompt = promptFor(request)
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now()
      let inputTokens = 0
      let outputTokens = 0
      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.data },
          ],
          text: { format: zodTextFormat(schema, request.purpose.replaceAll('-', '_')) },
        })
        inputTokens = response.usage?.input_tokens ?? 0
        outputTokens = response.usage?.output_tokens ?? 0
        if (!response.output_parsed)
          throw new Error('El modelo no devolvió una respuesta estructurada válida.')
        return schema.parse(response.output_parsed)
      } catch (error) {
        const transient =
          error instanceof OpenAI.APIConnectionError ||
          (error instanceof OpenAI.APIError && (error.status === 429 || (error.status ?? 0) >= 500))
        if (!transient || attempt === 2)
          throw new Error('La llamada a OpenAI falló. Revisa los modelos, la clave y la conexión.')
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt))
      } finally {
        this.db
          .insert(llmCalls)
          .values({
            id: randomUUID(),
            purpose: request.purpose,
            model,
            inputTokens,
            outputTokens,
            latencyMs: Date.now() - started,
            createdAt: this.clock().getTime(),
          })
          .run()
      }
    }
    throw new Error('No se pudo contactar con OpenAI.')
  }
}
export class ConfiguredLlm implements Llm {
  private limit = pLimit(3)
  private active = 0
  private offlineUntil = 0
  private live: OpenAiLlm
  private fake = new FakeLlm()
  constructor(
    private settings: SettingsService,
    private db: Db,
    private clock: () => Date,
    private status: (status: LlmStatus) => void,
  ) {
    this.live = new OpenAiLlm(settings, db, clock)
  }
  available() {
    if (this.settings.get().fakeLlm) return true
    if (this.clock().getTime() < this.offlineUntil) {
      this.status('offline')
      return false
    }
    const available = this.live.available()
    if (!available) this.status('no-key')
    return available
  }
  refreshStatus(reset = false) {
    if (reset) this.offlineUntil = 0
    if (this.available()) this.status(this.active ? 'generating' : 'idle')
  }
  async complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
    return this.limit(async () => {
      if (!this.available())
        throw new Error('El proveedor no está disponible. Se conserva el banco local.')
      this.active++
      this.status('generating')
      let failed = false
      try {
        if (!this.settings.get().fakeLlm) {
          const result = await this.live.complete(request, schema)
          this.offlineUntil = 0
          return result
        }
        const started = Date.now()
        try {
          return await this.fake.complete(request, schema)
        } finally {
          this.db
            .insert(llmCalls)
            .values({
              id: randomUUID(),
              purpose: request.purpose,
              model: 'FAKE_LLM',
              inputTokens: 0,
              outputTokens: 0,
              latencyMs: Date.now() - started,
              createdAt: this.clock().getTime(),
            })
            .run()
        }
      } catch (error) {
        failed = true
        this.offlineUntil = this.clock().getTime() + 30000
        this.status('offline')
        throw error
      } finally {
        this.active--
        if (!this.active && !failed) this.refreshStatus()
      }
    })
  }
}
