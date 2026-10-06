import { and, eq, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { concepts, edges, reviews } from '../db/schema'
import { diagnosisSchema, edgeSuggestionsSchema, type Effort } from '../../shared/domain'
import type { Llm } from '../llm/types'
import type { FsrsService } from './fsrs'
import type { SessionService } from './session'
import type { GenerationService } from './generation'
import { THRESHOLDS } from './difficulty'
export class GraphService {
  constructor(
    private db: Db,
    private llm: Llm,
    private fsrs: FsrsService,
    private sessions: SessionService,
    private generation: GenerationService,
    private clock: () => Date,
  ) {}
  async suggest(id: string) {
    if (!this.llm.available()) return
    const concept = this.db.select().from(concepts).where(eq(concepts.id, id)).get()
    if (!concept) return
    const others = this.db
      .select()
      .from(concepts)
      .where(eq(concepts.archived, false))
      .all()
      .filter((c) => c.id !== id)
    if (!others.length) return
    try {
      const result = await this.llm.complete(
        {
          purpose: 'suggest-edges',
          input: {
            newConcept: { id, title: concept.title, noteText: concept.noteText },
            existing: others.map((c) => ({
              id: c.id,
              title: c.title,
              summary: c.noteText.slice(0, 1500),
            })),
          },
        },
        edgeSuggestionsSchema,
      )
      const valid = new Set([id, ...others.map((c) => c.id)])
      if (!this.db.select().from(concepts).where(eq(concepts.id, id)).get()) return
      for (const edge of result.edges) {
        if (
          edge.fromId === edge.toId ||
          !valid.has(edge.fromId) ||
          !valid.has(edge.toId) ||
          (edge.fromId !== id && edge.toId !== id)
        )
          continue
        // Recheck both endpoints after asynchronous provider work.
        const endpoints = this.db
          .select()
          .from(concepts)
          .where(or(eq(concepts.id, edge.fromId), eq(concepts.id, edge.toId)))
          .all()
        if (endpoints.length === 2)
          this.db
            .insert(edges)
            .values({ id: randomUUID(), ...edge, status: 'suggested' })
            .onConflictDoNothing()
            .run()
      }
    } catch {
      /* Suggestions are optional; offline review remains available. */
    }
  }
  async onFailure(reviewId: string, effort: Effort, missingCriteria: string[]) {
    const review = this.db.select().from(reviews).where(eq(reviews.id, reviewId)).get()
    if (!review) return null
    const concept = this.db.select().from(concepts).where(eq(concepts.id, review.conceptId)).get()
    if (!concept) return null
    const feedback = review.userOverrideVerdict
      ? `El estudiante corrigió la valoración a ${review.userOverrideVerdict}. Evaluación original: ${review.graderReasoning}`
      : review.graderReasoning
    const summary = `Revisar ${concept.title}: ${feedback}`.slice(0, 300)
    // Do not apply a late diagnosis to an edited/deleted note.
    const current = this.db.select().from(concepts).where(eq(concepts.id, concept.id)).get()
    if (!current || current.noteText !== concept.noteText) return null
    this.db.update(reviews).set({ errorSummary: summary }).where(eq(reviews.id, reviewId)).run()
    this.db
      .update(concepts)
      .set({ nextAngleHint: summary })
      .where(eq(concepts.id, concept.id))
      .run()
    const prerequisites = this.db
      .select({ concept: concepts })
      .from(edges)
      .innerJoin(concepts, eq(edges.fromId, concepts.id))
      .where(
        and(
          eq(edges.toId, concept.id),
          eq(edges.relation, 'prerequisite_of'),
          eq(edges.status, 'confirmed'),
          eq(concepts.archived, false),
        ),
      )
      .all()
      .map((r) => r.concept)
    const weak = prerequisites
      .filter(
        (c) =>
          c.due <= this.clock().getTime() ||
          this.fsrs.retrievability(this.fsrs.deserialize(c.fsrsCardJson)) <
            THRESHOLDS.prerequisiteRetrievability,
      )
      .sort((a, b) => this.sessions.retrievability(a) - this.sessions.retrievability(b))[0]
    // Retire stale pool items so the failure-targeted refill actually produces a new angle.
    this.generation.retireForConcept(concept.id, true)
    if (this.llm.available()) {
      // Diagnosis is asynchronous: an unavailable provider cannot hold up the review result.
      void this.llm
        .complete(
          {
            purpose: 'diagnose',
            input: {
              title: concept.title,
              noteText: concept.noteText,
              userAnswer: review.userAnswer,
              feedback,
              missingCriteria,
            },
          },
          diagnosisSchema,
        )
        .then((result) => {
          const current = this.db.select().from(concepts).where(eq(concepts.id, concept.id)).get()
          const stored = this.db.select().from(reviews).where(eq(reviews.id, reviewId)).get()
          if (
            !current ||
            !stored ||
            current.noteText !== concept.noteText ||
            current.nextAngleHint !== summary ||
            stored.userOverrideVerdict === 'pass'
          )
            return
          this.db
            .update(reviews)
            .set({ errorSummary: result.errorSummary })
            .where(eq(reviews.id, reviewId))
            .run()
          this.db
            .update(concepts)
            .set({ nextAngleHint: result.errorSummary })
            .where(eq(concepts.id, concept.id))
            .run()
          this.generation.retireForConcept(concept.id, true)
          return this.generation.refillConcept(concept.id, undefined, true)
        })
        .catch(() => {
          /* The immediate local diagnosis remains usable. */
        })
    }
    void this.generation.refillConcept(concept.id, undefined, true)
    return weak
      ? this.sessions.reinforcement(
          weak.id,
          effort,
          `Refuerzo: fallaste ${concept.title} y «${weak.title}» es un prerrequisito débil. ${summary}`,
        )
      : null
  }
}
