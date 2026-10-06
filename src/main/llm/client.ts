import OpenAI from 'openai'
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
  constructor(private settings: SettingsService, private db: Db, private clock: () => Date) {}
  available() { const s = this.settings.get(); return this.settings.publicGet().apiKeySet && Boolean(s.modelGenerate && s.modelVerify) }
  async complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
    const s = this.settings.get()
    const model = ['generate', 'diagnose', 'suggest-edges'].includes(request.purpose) ? s.modelGenerate : s.modelVerify
    const key = this.settings.apiKey()
    if (!key || !model) throw new Error('Configura una clave API y ambos modelos en Ajustes.')
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 20000 })
    const prompt = promptFor(request)
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now()
      let inputTokens = 0; let outputTokens = 0
      try {
        const response = await client.responses.parse({ model, store: false, input: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.data }], text: { format: zodTextFormat(schema, request.purpose.replaceAll('-', '_')) } })
        inputTokens = response.usage?.input_tokens ?? 0; outputTokens = response.usage?.output_tokens ?? 0
        if (!response.output_parsed) throw new Error('El modelo no devolvió una respuesta estructurada válida.')
        return schema.parse(response.output_parsed)
      } catch (error) {
        const transient = error instanceof OpenAI.APIConnectionError || error instanceof OpenAI.APIError && (error.status === 429 || (error.status ?? 0) >= 500)
        if (!transient || attempt === 2) throw new Error('La llamada a OpenAI falló. Revisa los modelos, la clave y la conexión.')
        await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt))
      } finally {
        this.db.insert(llmCalls).values({ id: randomUUID(), purpose: request.purpose, model, inputTokens, outputTokens, latencyMs: Date.now() - started, createdAt: this.clock().getTime() }).run()
      }
    }
    throw new Error('No se pudo contactar con OpenAI.')
  }
}
export class ConfiguredLlm implements Llm {
  private limit = pLimit(3)
  private active = 0
  private live: OpenAiLlm
  private fake = new FakeLlm()
  constructor(private settings: SettingsService, private db: Db, private clock: () => Date, private status: (status: LlmStatus) => void) { this.live = new OpenAiLlm(settings, db, clock) }
  available() { const available = this.settings.get().fakeLlm || this.live.available(); if (!available) this.status('no-key'); return available }
  refreshStatus() { this.status(this.available() ? this.active ? 'generating' : 'idle' : 'no-key') }
  async complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
    return this.limit(async () => {
      this.active++; this.status('generating')
      let failed = false
      try {
        if (!this.settings.get().fakeLlm) return await this.live.complete(request, schema)
        const started = Date.now()
        try { return await this.fake.complete(request, schema) } finally { this.db.insert(llmCalls).values({ id: randomUUID(), purpose: request.purpose, model: 'FAKE_LLM', inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started, createdAt: this.clock().getTime() }).run() }
      } catch (error) { failed = true; this.status('offline'); throw error } finally { this.active--; if (!this.active && !failed) this.refreshStatus() }
    })
  }
}
