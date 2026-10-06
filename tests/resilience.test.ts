import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { concepts, edges, reviews, variants, llmCalls } from '../src/main/db/schema'
import { createServices } from '../src/main/services/container'
import { SettingsService } from '../src/main/services/settings'
import { FakeLlm } from '../src/main/llm/fake'
import { ConfiguredLlm } from '../src/main/llm/client'
import { VerificationService } from '../src/main/services/verification'
import { generationSchema } from '../src/shared/domain'
import { fixture } from './helpers'
import type { Llm } from '../src/main/llm/types'
function configured(f: ReturnType<typeof fixture>, llm: Llm = new FakeLlm()) {
  const settings = new SettingsService(
    null,
    { has: () => false, get: () => null, set: () => {}, warning: () => null },
    { fakeLlm: true },
  )
  return createServices(f.db, settings, llm, f.clock, () => {})
}
describe('resilient review workflow', () => {
  it('supports numeric and open-answer reviews with a fake provider and hints cap Easy', async () => {
    const f = fixture()
    const id = f.concept('Teorema de Pitágoras', undefined, 'problem')
    const s = configured(f)
    await s.generation.refillConcept(id)
    const mcqs = f.db
      .select()
      .from(variants)
      .all()
      .filter((v) => v.type === 'mcq')
    for (const mcq of mcqs)
      f.db.update(variants).set({ timesShown: 1 }).where(eq(variants.id, mcq.id)).run()
    const numeric = s.session.build({ effort: 'normal', minutes: 10 })[0]!
    expect(numeric.type).toBe('numeric_problem')
    const answer = f.db.select().from(variants).where(eq(variants.id, numeric.variantId!)).get()!
      .correctAnswer
    const result = await s.reviews.submit({
      conceptId: id,
      variantId: numeric.variantId,
      userAnswer: `(${answer}*2)/2`,
      responseTimeMs: 1000,
      hintUsed: true,
    })
    expect(result.verdict).toBe('pass')
    expect(result.rating).toBe(3)
    await s.generation.refillConcept(id)
    f.db.update(concepts).set({ due: f.clock().getTime() }).where(eq(concepts.id, id)).run()
    for (const variant of f.db
      .select()
      .from(variants)
      .all()
      .filter((v) => v.type !== 'open_problem'))
      f.db.update(variants).set({ timesShown: 1 }).where(eq(variants.id, variant.id)).run()
    const open = s.session.build({ effort: 'deep', minutes: 10 })[0]!
    expect(open.type).toBe('open_problem')
    const reference = f.db.select().from(variants).where(eq(variants.id, open.variantId!)).get()!
      .correctAnswer
    const graded = await s.reviews.submit({
      conceptId: id,
      variantId: open.variantId,
      userAnswer: reference,
      responseTimeMs: 100000,
      hintUsed: false,
    })
    expect(graded.verdict).toBe('pass')
    expect(graded.rating).toBe(3)
    await s.generation.refillAll()
    f.close()
  })
  it('falls back to self rating after an open grader outage', async () => {
    const f = fixture()
    const id = f.concept('Pitágoras', undefined, 'problem')
    const fake = new FakeLlm()
    const llm: Llm = {
      available: () => true,
      complete: (request, schema) =>
        request.purpose === 'grade'
          ? Promise.reject(new Error('offline'))
          : fake.complete(request, schema),
    }
    const s = configured(f, llm)
    await s.generation.refillConcept(id)
    for (const variant of f.db
      .select()
      .from(variants)
      .all()
      .filter((v) => v.type !== 'open_problem'))
      f.db.update(variants).set({ status: 'retired' }).where(eq(variants.id, variant.id)).run()
    const item = s.session.build({ effort: 'deep', minutes: 10 })[0]!
    expect(item.answerType).toBe('open')
    await expect(
      s.reviews.submit({
        conceptId: id,
        variantId: item.variantId,
        userAnswer: 'respuesta',
        responseTimeMs: 10000,
        hintUsed: false,
      }),
    ).rejects.toThrow('autoevaluarte')
    s.session.reveal(id, item.variantId)
    const result = await s.reviews.submit({
      conceptId: id,
      variantId: item.variantId,
      selfRating: 3,
      responseTimeMs: 10000,
      hintUsed: false,
    })
    expect(result.rating).toBe(3)
    await s.generation.refillAll()
    f.close()
  })
  it('keeps static reviews usable without an available LLM', async () => {
    const f = fixture()
    const id = f.concept()
    const llm: Llm = {
      available: () => false,
      complete: () => Promise.reject(new Error('must not call')),
    }
    const s = configured(f, llm)
    const item = s.session.build({ effort: 'deep', minutes: 1 })[0]!
    expect(item.variantId).toBeNull()
    s.session.reveal(id, null)
    const result = await s.reviews.submit({
      conceptId: id,
      variantId: null,
      selfRating: 1,
      responseTimeMs: 20000,
      hintUsed: false,
    })
    expect(result.verdict).toBe('fail')
    expect(f.db.select().from(reviews).get()?.errorSummary).toBeTruthy()
    await s.generation.refillAll()
    f.close()
  })
  it('rejects double submission, retired delivery and changed notes', async () => {
    const f = fixture()
    const id = f.concept()
    const s = configured(f)
    await s.generation.refillConcept(id)
    const item = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    s.session.reveal(id, item.variantId)
    await s.reviews.submit({
      conceptId: id,
      variantId: item.variantId,
      selfRating: 3,
      responseTimeMs: 10000,
      hintUsed: false,
    })
    await expect(
      s.reviews.submit({
        conceptId: id,
        variantId: item.variantId,
        selfRating: 3,
        responseTimeMs: 10000,
        hintUsed: false,
      }),
    ).rejects.toThrow('ya se respondió')
    await s.generation.refillAll()
    f.db.update(concepts).set({ due: f.clock().getTime() }).where(eq(concepts.id, id)).run()
    const next = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    s.concepts.update(id, { noteText: 'Una nota completamente distinta.' })
    expect(() => s.session.reveal(id, next.variantId)).toThrow('cambió')
    await s.generation.refillAll()
    const retired = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    s.variants.report(retired.variantId!)
    s.variants.report(retired.variantId!)
    expect(() => s.session.reveal(id, retired.variantId)).toThrow('ya no está')
    await s.generation.refillAll()
    f.close()
  })
  it('does not propagate through suggested prerequisite edges', async () => {
    const f = fixture()
    const id = f.concept()
    const prerequisite = f.concept('Otro concepto')
    f.db
      .insert(edges)
      .values({
        id: randomUUID(),
        fromId: prerequisite,
        toId: id,
        relation: 'prerequisite_of',
        status: 'suggested',
        rationale: 'No confirmada',
      })
      .run()
    const s = configured(f)
    s.session.build({ effort: 'quick', minutes: 1 })
    s.session.reveal(id, null)
    const result = await s.reviews.submit({
      conceptId: id,
      variantId: null,
      selfRating: 1,
      responseTimeMs: 20000,
      hintUsed: false,
    })
    expect(result.followUp).toBeNull()
    await s.generation.refillAll()
    f.close()
  })
  it('does not rewrite the current concept when overriding an older review', async () => {
    const f = fixture()
    const id = f.concept()
    const llm: Llm = {
      available: () => false,
      complete: () => Promise.reject(new Error('offline')),
    }
    const s = configured(f, llm)
    s.session.build({ effort: 'quick', minutes: 1 })
    s.session.reveal(id, null)
    const first = await s.reviews.submit({
      conceptId: id,
      variantId: null,
      selfRating: 3,
      responseTimeMs: 10000,
      hintUsed: false,
    })
    f.db.update(concepts).set({ due: f.clock().getTime() }).where(eq(concepts.id, id)).run()
    s.session.build({ effort: 'quick', minutes: 1 })
    s.session.reveal(id, null)
    await s.reviews.submit({
      conceptId: id,
      variantId: null,
      selfRating: 3,
      responseTimeMs: 10000,
      hintUsed: false,
    })
    const before = s.concepts.get(id).concept.due
    expect((await s.reviews.override(first.reviewId, 'fail')).appliedToConcept).toBe(false)
    expect(s.concepts.get(id).concept.due).toBe(before)
    await s.generation.refillAll()
    f.close()
  })
  it('counts only newly introduced concepts against the daily new limit', async () => {
    const f = fixture()
    const first = f.concept()
    f.concept('Segundo')
    const s = configured(f, {
      available: () => false,
      complete: () => Promise.reject(new Error('offline')),
    })
    s.settings.set({ newConceptsPerDay: 1 })
    s.session.build({ effort: 'quick', minutes: 1 })
    s.session.reveal(first, null)
    await s.reviews.submit({
      conceptId: first,
      variantId: null,
      selfRating: 3,
      responseTimeMs: 10000,
      hintUsed: false,
    })
    expect(s.session.build({ effort: 'quick', minutes: 10 })).toHaveLength(0)
    await s.generation.refillAll()
    f.close()
  })
  it('rejects numeric disagreement with the independent math verifier', async () => {
    const f = fixture()
    const fake = new FakeLlm('hallucinated')
    const generated = await fake.complete(
      {
        purpose: 'generate',
        input: {
          conceptId: randomUUID(),
          title: 'Pitágoras',
          noteText: 'Los catetos a y b de un triángulo rectángulo cumplen a² + b² = c².',
          targetType: 'numeric_problem',
          bloomLevel: 'apply',
          difficulty: 2,
          recentErrors: [],
          nextAngleHint: null,
          existingQuestions: [],
        },
      },
      generationSchema,
    )
    const report = await new VerificationService(fake).verify(
      generated.variant!,
      'Los catetos a y b de un triángulo rectángulo cumplen a² + b² = c².',
    )
    expect(report.consistent).toBe(false)
    expect(report.issues.some((issue) => issue.includes('numérica'))).toBe(true)
    f.close()
  })
  it('logs every simulated provider call without model costs', async () => {
    const f = fixture()
    const settings = new SettingsService(
      null,
      { has: () => false, get: () => null, set: () => {}, warning: () => null },
      { fakeLlm: true },
    )
    const llm = new ConfiguredLlm(settings, f.db, f.clock, () => {})
    const s = createServices(f.db, settings, llm, f.clock, () => {})
    const id = f.concept()
    await s.generation.refillConcept(id, 1)
    expect(
      f.db
        .select()
        .from(llmCalls)
        .all()
        .map((c) => c.purpose),
    ).toEqual(['generate', 'blind-solve', 'judge'])
    expect(s.stats.get().llmCosts.reduce((sum, c) => sum + c.estimatedUsd, 0)).toBe(0)
    f.close()
  })
})
