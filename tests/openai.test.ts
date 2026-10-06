import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAiLlm } from '../src/main/llm/client'
import { SettingsService } from '../src/main/services/settings'
import { llmCalls } from '../src/main/db/schema'
import { blindSchema } from '../src/shared/domain'
import { fixture } from './helpers'
const mocks = vi.hoisted(() => ({ constructor: vi.fn(), parse: vi.fn() }))
vi.mock('openai', async () => {
  const actual = await vi.importActual<typeof import('openai')>('openai')
  return {
    default: class {
      static APIConnectionError = actual.default.APIConnectionError
      static APIError = actual.default.APIError
      responses = { parse: mocks.parse }
      constructor(options: unknown) {
        mocks.constructor(options)
      }
    },
  }
})
const request = {
  purpose: 'blind-solve' as const,
  input: {
    questionMd: 'What is 10/2?',
    choices: null,
    noteText: '10/2 = 5.',
    answerType: 'numeric' as const,
  },
}
function settings() {
  return new SettingsService(
    null,
    { has: () => true, get: () => 'unit-test-key', set: () => {}, warning: () => null },
    { modelGenerate: 'generate-test-placeholder', modelVerify: 'verify-test-placeholder' },
  )
}
beforeEach(() => {
  mocks.constructor.mockReset()
  mocks.parse.mockReset()
  for (const name of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'])
    vi.stubEnv(name, '')
})
afterEach(() => vi.unstubAllEnvs())
describe('OpenAI transport and audit log (mock SDK, no network)', () => {
  it('uses paired proxy fetch/dispatcher and the official API endpoint', async () => {
    vi.stubEnv('HTTPS_PROXY', 'http://127.0.0.1:18080')
    const f = fixture()
    mocks.parse.mockResolvedValue({
      output_parsed: { answer: '5' },
      usage: { input_tokens: 17, output_tokens: 3 },
    })
    const llm = new OpenAiLlm(settings(), f.db, f.clock)
    expect(await llm.complete(request, blindSchema)).toEqual({ answer: '5' })
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.openai.com/v1',
        fetch: expect.any(Function),
        fetchOptions: { dispatcher: expect.any(Object) },
        maxRetries: 0,
        timeout: 20000,
      }),
    )
    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'verify-test-placeholder',
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema', strict: true }),
        }),
      }),
    )
    expect(f.db.select().from(llmCalls).get()).toMatchObject({
      purpose: 'blind-solve',
      model: 'verify-test-placeholder',
      inputTokens: 17,
      outputTokens: 3,
    })
    expect(JSON.stringify(f.db.select().from(llmCalls).all())).not.toContain('unit-test-key')
    f.close()
  })
  it('uses the native fetch default when no proxy is configured', async () => {
    const f = fixture()
    mocks.parse.mockResolvedValue({
      output_parsed: { answer: '5' },
      usage: { input_tokens: 2, output_tokens: 1 },
    })
    await new OpenAiLlm(settings(), f.db, f.clock).complete(request, blindSchema)
    expect(mocks.constructor.mock.calls[0][0]).not.toHaveProperty('fetchOptions')
    expect(mocks.constructor.mock.calls[0][0]).not.toHaveProperty('fetch')
    f.close()
  })
  it('logs refusals and exposes a safe error without leaking a key', async () => {
    const f = fixture()
    mocks.parse.mockResolvedValue({
      output_parsed: null,
      usage: { input_tokens: 8, output_tokens: 2 },
    })
    await expect(
      new OpenAiLlm(settings(), f.db, f.clock).complete(request, blindSchema),
    ).rejects.toThrow('Revisa los modelos')
    expect(f.db.select().from(llmCalls).get()).toMatchObject({ inputTokens: 8, outputTokens: 2 })
    f.close()
  })
})
