import { desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { concepts, reviews, variants } from '../db/schema'
import type { Verdict, ReviewResult } from '../../shared/domain'
import type { Llm } from '../llm/types'
import { ratingFromVerdict, verdictFromRating, type FsrsService, type FsrsRating } from './fsrs'
import type { SessionService } from './session'
import type { GradingService } from './grading'
import type { GraphService } from './graph'
export interface SubmitInput {
  conceptId: string
  variantId: string | null
  userAnswer?: string
  selfRating?: number
  responseTimeMs: number
  hintUsed: boolean
}
export class ReviewService {
  private busy = new Set<string>()
  private offlineGrades = new Set<string>()
  constructor(
    private db: Db,
    private fsrs: FsrsService,
    private session: SessionService,
    private grading: GradingService,
    private graph: GraphService,
    private llm: Llm,
    private clock: () => Date,
    private refill: (id: string) => void,
  ) {}
  async submit(input: SubmitInput): Promise<ReviewResult> {
    if (this.busy.has(input.conceptId))
      throw new Error('Ya se está guardando una respuesta para este concepto.')
    this.busy.add(input.conceptId)
    try {
      const served = this.session.getServed(input.conceptId, input.variantId)
      const { item, variant, noteText } = served
      let grade
      let rating: FsrsRating
      if (input.selfRating !== undefined) {
        if (!served.revealed) throw new Error('Muestra primero la respuesta para autoevaluarte.')
        if (
          item.answerType !== 'self' &&
          item.effort !== 'quick' &&
          !(
            item.answerType === 'open' &&
            (!this.llm.available() || this.offlineGrades.has(input.conceptId))
          )
        )
          throw new Error('La autoevaluación de esta variante requiere el modo rápido.')
        rating = input.selfRating as FsrsRating
        if (input.hintUsed && rating === 4) rating = 3
        grade = {
          verdict: verdictFromRating(rating),
          reasoning: 'Autoevaluación del estudiante.',
          missingCriteria: [] as string[],
        }
      } else {
        if (!variant || item.answerType === 'self')
          throw new Error('Selecciona una valoración de 1 a 4.')
        try {
          grade = await this.grading.grade(variant, input.userAnswer ?? '', noteText)
        } catch {
          this.offlineGrades.add(input.conceptId)
          throw new Error(
            'No se pudo evaluar la respuesta abierta. Puedes mostrar la solución y autoevaluarte sin conexión.',
          )
        }
        rating = ratingFromVerdict(grade.verdict, item.type, input.responseTimeMs, input.hintUsed)
      }
      this.session.getServed(input.conceptId, input.variantId)
      const now = this.clock()
      const after = this.fsrs.schedule(this.fsrs.deserialize(served.cardJson), rating, now)
      const reviewId = randomUUID()
      this.db.transaction((tx) => {
        tx.insert(reviews)
          .values({
            id: reviewId,
            conceptId: input.conceptId,
            variantId: input.variantId,
            userAnswer: input.userAnswer ?? '',
            selfRating: input.selfRating ?? null,
            verdict: grade.verdict,
            rating,
            graderReasoning: grade.reasoning,
            responseTimeMs: input.responseTimeMs,
            hintUsed: input.hintUsed,
            selectionReason: item.selectionReason,
            cardStateBeforeJson: served.cardJson,
            cardStateAfterJson: this.fsrs.serialize(after),
            reviewedAt: now.getTime(),
          })
          .run()
        tx.update(concepts)
          .set({
            ...this.fsrs.columns(after),
            nextAngleHint: grade.verdict === 'pass' ? null : undefined,
          })
          .where(eq(concepts.id, input.conceptId))
          .run()
      })
      this.session.consume(input.conceptId, input.variantId)
      this.offlineGrades.delete(input.conceptId)
      const followUp =
        rating === 1 || (rating === 2 && grade.missingCriteria.length)
          ? await this.graph.onFailure(reviewId, item.effort, grade.missingCriteria)
          : null
      this.refill(input.conceptId)
      return {
        reviewId,
        verdict: grade.verdict,
        rating,
        feedback: grade.reasoning,
        missingCriteria: grade.missingCriteria,
        correctAnswer: variant?.correctAnswer ?? noteText,
        solutionStepsMd: variant?.solutionStepsMd ?? '',
        noteText,
        nextDue: after.due.getTime(),
        followUp,
      }
    } finally {
      this.busy.delete(input.conceptId)
    }
  }
  async override(reviewId: string, verdict: Verdict) {
    const review = this.db.select().from(reviews).where(eq(reviews.id, reviewId)).get()
    if (!review) throw new Error('No se encontró el repaso.')
    if (this.busy.has(review.conceptId))
      throw new Error('Espera a que termine el repaso actual antes de corregirlo.')
    const variant = review.variantId
      ? this.db.select().from(variants).where(eq(variants.id, review.variantId)).get()
      : null
    const rating = ratingFromVerdict(
      verdict,
      variant?.type ?? 'recall',
      review.responseTimeMs,
      review.hintUsed,
    )
    const after = this.fsrs.override(
      review.cardStateBeforeJson,
      rating,
      new Date(review.reviewedAt),
    )
    const latest = this.db
      .select()
      .from(reviews)
      .where(eq(reviews.conceptId, review.conceptId))
      .orderBy(desc(reviews.reviewedAt), desc(sql`rowid`))
      .limit(1)
      .get()
    this.db.transaction((tx) => {
      tx.update(reviews)
        .set({
          userOverrideVerdict: verdict,
          rating,
          cardStateAfterJson: this.fsrs.serialize(after),
          errorSummary: verdict === 'pass' ? null : review.errorSummary,
        })
        .where(eq(reviews.id, reviewId))
        .run()
      if (latest?.id === reviewId)
        tx.update(concepts)
          .set({
            ...this.fsrs.columns(after),
            nextAngleHint: verdict === 'pass' ? null : undefined,
          })
          .where(eq(concepts.id, review.conceptId))
          .run()
    })
    const followUp =
      latest?.id === reviewId && (rating === 1 || rating === 2)
        ? await this.graph.onFailure(
            reviewId,
            'quick',
            verdict === 'partial' ? [review.graderReasoning] : [],
          )
        : null
    if (latest?.id === reviewId) this.refill(review.conceptId)
    return {
      verdict,
      rating,
      followUp,
      nextDue:
        latest?.id === reviewId
          ? after.due.getTime()
          : this.db.select().from(concepts).where(eq(concepts.id, review.conceptId)).get()!.due,
      appliedToConcept: latest?.id === reviewId,
    }
  }
}
