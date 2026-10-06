import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { concepts, edges, reviews, variants } from '../src/main/db/schema'
import { fixture } from './helpers'
import { FakeLlm } from '../src/main/llm/fake'
import {
  GradingService,
  closedEqual,
  numericEqual,
  numericValue,
} from '../src/main/services/grading'
import { calibrate, allowedTypes } from '../src/main/services/difficulty'
import { SessionService } from '../src/main/services/session'
import { GenerationService } from '../src/main/services/generation'
import { GraphService } from '../src/main/services/graph'
import { ReviewService } from '../src/main/services/reviews'
import { VariantService } from '../src/main/services/variants'
function services(f: ReturnType<typeof fixture>, scenario: 'good' | 'hallucinated' = 'good') {
  const llm = new FakeLlm(scenario)
  const generation = new GenerationService(
    f.db,
    llm,
    f.fsrs,
    () => f.settings,
    f.clock,
    () => {},
  )
  const session = new SessionService(
    f.db,
    f.fsrs,
    () => f.settings,
    f.clock,
    () => {},
  )
  const graph = new GraphService(f.db, llm, f.fsrs, session, generation, f.clock)
  const review = new ReviewService(
    f.db,
    f.fsrs,
    session,
    new GradingService(llm),
    graph,
    llm,
    f.clock,
    () => {},
  )
  return { generation, session, graph, review }
}
describe('closed graders', () => {
  it('normalizes accents, case and whitespace and accepted answers', () => {
    expect(
      closedEqual(
        {
          answerType: 'text_exact',
          correctAnswer: 'Raíz Cuadrada',
          acceptedAnswers: ['sqrt'],
          choices: null,
        },
        '  RAIZ   cuadrada  ',
      ),
    ).toBe(true)
    expect(
      closedEqual(
        {
          answerType: 'text_exact',
          correctAnswer: 'Raíz',
          acceptedAnswers: ['sqrt'],
          choices: null,
        },
        'sqrt',
      ),
    ).toBe(true)
  })
  it('compares equivalent numeric expressions with tolerance without executing code', () => {
    for (const value of ['5', '5.0', '10/2', 'sqrt(25)', '5,0', '5.0000001'])
      expect(numericEqual('5', value)).toBe(true)
    expect(numericEqual('5', '5.01')).toBe(false)
    expect(numericValue('import("fs")')).toBeNull()
    expect(numericValue('a=5')).toBeNull()
    expect(numericValue('Infinity')).toBeNull()
    expect(numericValue('factorial(100000000)')).toBeNull()
  })
  it('grades zero-based MCQ indices', () => {
    const variant = {
      answerType: 'mcq' as const,
      correctAnswer: '1',
      acceptedAnswers: [],
      choices: ['A', 'B'],
    }
    expect(closedEqual(variant, '1')).toBe(true)
    expect(closedEqual(variant, 'B')).toBe(false)
    expect(closedEqual(variant, '2')).toBe(false)
  })
})
describe('difficulty', () => {
  it('uses FSRS thresholds and mode/effort intersections', () => {
    expect(calibrate({ state: 0, stability: 0, retrievability: 0 }, 'both', 'quick')).toMatchObject(
      { bloomLevel: 'remember', difficulty: 1, allowedTypes: ['recall', 'cloze', 'mcq'] },
    )
    expect(
      calibrate({ state: 2, stability: 10, retrievability: 0.9 }, 'both', 'normal'),
    ).toMatchObject({ bloomLevel: 'apply', difficulty: 3 })
    expect(
      calibrate({ state: 2, stability: 14, retrievability: 0.9 }, 'both', 'deep'),
    ).toMatchObject({ bloomLevel: 'apply', difficulty: 4 })
    expect(
      calibrate({ state: 2, stability: 60, retrievability: 0.9 }, 'both', 'deep'),
    ).toMatchObject({ bloomLevel: 'analyze', difficulty: 5 })
    expect(
      calibrate({ state: 2, stability: 60, retrievability: 0.6 }, 'both', 'deep').difficulty,
    ).toBe(2)
    expect(allowedTypes('problem', 'quick')).toEqual(['mcq'])
  })
})
describe('sessions and reviews', () => {
  it('uses static fallback and honors a minutes budget and daily new limit', () => {
    const f = fixture()
    for (let i = 0; i < 10; i++) f.concept(`Concepto ${i}`)
    const s = services(f)
    const session = s.session.build({ effort: 'normal', minutes: 1 })
    expect(session).toHaveLength(3)
    expect(session.every((item) => item.variantId === null && item.answerType === 'self')).toBe(
      true,
    )
    expect(session.reduce((n, item) => n + item.estimatedSeconds, 0)).toBeLessThanOrEqual(60)
    f.settings.newConceptsPerDay = 1
    expect(s.session.build({ effort: 'quick', minutes: 10 })).toHaveLength(1)
    f.close()
  })
  it('never serves rejected variants and obeys effort intersection', async () => {
    const f = fixture()
    const id = f.concept('Pitágoras', undefined, 'problem')
    const s = services(f, 'hallucinated')
    await s.generation.refillConcept(id, 1)
    expect(s.session.build({ effort: 'quick', minutes: 1 })[0]?.variantId).toBeNull()
    await services(f).generation.refillConcept(id)
    const item = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    expect(item.type).toBe('mcq')
    expect(f.db.select().from(variants).where(eq(variants.id, item.variantId!)).get()?.status).toBe(
      'verified',
    )
    f.close()
  })
  it('avoids repeating the last variant type if another unseen type exists', async () => {
    const f = fixture()
    const id = f.concept()
    const s = services(f)
    await s.generation.refillConcept(id)
    const first = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    s.session.reveal(id, first.variantId)
    await s.review.submit({
      conceptId: id,
      variantId: first.variantId,
      selfRating: 1,
      hintUsed: false,
      responseTimeMs: 20000,
    })
    await s.generation.refillConcept(id)
    f.db.update(concepts).set({ due: f.clock().getTime() }).where(eq(concepts.id, id)).run()
    const second = s.session.build({ effort: 'quick', minutes: 1 })[0]!
    expect(second.type).not.toBe(first.type)
    f.close()
  })
  it('stores error diagnosis, inserts only a weak confirmed prerequisite, and records overrides', async () => {
    const f = fixture()
    const root = f.concept()
    const prerequisite = f.concept(
      'Raíz cuadrada',
      'La raíz cuadrada principal es la operación inversa de elevar al cuadrado.',
    )
    f.db
      .insert(edges)
      .values({
        id: randomUUID(),
        fromId: prerequisite,
        toId: root,
        relation: 'prerequisite_of',
        status: 'confirmed',
        rationale: 'Para despejar c',
      })
      .run()
    const s = services(f)
    const item = s.session.build({ effort: 'quick', minutes: 1 }).find((i) => i.conceptId === root)!
    s.session.reveal(root, item.variantId)
    const result = await s.review.submit({
      conceptId: root,
      variantId: item.variantId,
      selfRating: 1,
      responseTimeMs: 25000,
      hintUsed: false,
    })
    expect(result.rating).toBe(1)
    expect(result.followUp?.conceptId).toBe(prerequisite)
    expect(result.followUp?.selectionReason).toContain('prerrequisito')
    const row = f.db.select().from(reviews).where(eq(reviews.id, result.reviewId)).get()!
    expect(row.errorSummary).toBeTruthy()
    expect(f.db.select().from(concepts).where(eq(concepts.id, root)).get()?.nextAngleHint).toBe(
      row.errorSummary,
    )
    const override = await s.review.override(result.reviewId, 'pass')
    expect(override.appliedToConcept).toBe(true)
    const expected = f.fsrs.override(
      row.cardStateBeforeJson,
      override.rating,
      new Date(row.reviewedAt),
    )
    expect(f.db.select().from(concepts).where(eq(concepts.id, root)).get()?.fsrsCardJson).toBe(
      f.fsrs.serialize(expected),
    )
    expect(
      f.db.select().from(reviews).where(eq(reviews.id, result.reviewId)).get()?.userOverrideVerdict,
    ).toBe('pass')
    expect(f.db.select().from(reviews).where(eq(reviews.id, result.reviewId)).get()?.verdict).toBe(
      'fail',
    )
    await s.generation.refillConcept(root)
    f.close()
  })
  it('retires a variant on its second report and excludes it from sessions', async () => {
    const f = fixture()
    const id = f.concept()
    const s = services(f)
    await s.generation.refillConcept(id, 1)
    const variant = f.db.select().from(variants).get()!
    const service = new VariantService(
      f.db,
      () => {},
      () => {},
    )
    expect(service.report(variant.id).status).toBe('verified')
    expect(service.report(variant.id).status).toBe('retired')
    expect(s.session.build({ effort: 'quick', minutes: 1 })[0]?.variantId).toBeNull()
    f.close()
  })
})
