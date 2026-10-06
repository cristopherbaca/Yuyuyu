import { describe, expect, it } from 'vitest'
import { ipcSchemas } from '../src/shared/ipc'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers'
import { SettingsService } from '../src/main/services/settings'
import { createServices } from '../src/main/services/container'
import { FakeLlm } from '../src/main/llm/fake'
describe('IPC payloads', () => {
  it('rejects malformed and unexpected fields', () => {
    expect(ipcSchemas['concepts:create'].safeParse({ title: '', noteText: 'Note' }).success).toBe(
      false,
    )
    expect(
      ipcSchemas['concepts:create'].safeParse({ title: 'Title', noteText: 'Note', apiKey: 'bad' })
        .success,
    ).toBe(false)
    expect(
      ipcSchemas['reviews:submit'].safeParse({
        conceptId: randomUUID(),
        variantId: null,
        selfRating: 5,
        responseTimeMs: 1,
        hintUsed: false,
      }).success,
    ).toBe(false)
    expect(ipcSchemas['session:build'].safeParse({ effort: 'quick', minutes: -1 }).success).toBe(
      false,
    )
    expect(ipcSchemas['app:openExternal'].safeParse('file:///etc/passwd').success).toBe(false)
    expect(ipcSchemas['app:openExternal'].safeParse('https://example.com').success).toBe(true)
    expect(ipcSchemas['settings:set'].safeParse({ apiKey: 'should-not-be-here' }).success).toBe(
      false,
    )
  })
  it('accepts the documented payloads', () => {
    expect(
      ipcSchemas['concepts:create'].parse({ title: 'Concepto', noteText: 'Nota' }).modePref,
    ).toBe('both')
    expect(
      ipcSchemas['reviews:submit'].safeParse({
        conceptId: randomUUID(),
        variantId: null,
        selfRating: 3,
        responseTimeMs: 2000,
        hintUsed: false,
      }).success,
    ).toBe(true)
  })
})
describe('integrated offline workflow', () => {
  it('seeds idempotently, refills, reviews, exports and computes statistics', async () => {
    const f = fixture()
    const settings = new SettingsService(
      null,
      { has: () => false, get: () => null, set: () => {}, warning: () => null },
      { fakeLlm: true },
    )
    const s = createServices(f.db, settings, new FakeLlm(), f.clock, () => {})
    expect(s.data.seed().created).toBe(3)
    expect(s.data.seed().created).toBe(0)
    s.jobs.refillNow()
    await s.jobs.drain()
    expect(s.concepts.list().every((c) => c.poolSize === 5)).toBe(true)
    const item = s.session.build({ effort: 'normal', minutes: 10 })[0]!
    s.session.reveal(item.conceptId, item.variantId)
    const result = await s.reviews.submit({
      conceptId: item.conceptId,
      variantId: item.variantId,
      selfRating: 3,
      responseTimeMs: 25000,
      hintUsed: false,
    })
    expect(result.nextDue).toBeGreaterThan(f.clock().getTime())
    expect(s.stats.get().reviewsToday).toBe(1)
    expect(s.data.export().reviews).toHaveLength(1)
    await s.generation.refillAll()
    f.close()
  })
})
