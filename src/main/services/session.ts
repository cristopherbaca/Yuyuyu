import { and, asc, desc, eq } from 'drizzle-orm'
import { State } from 'ts-fsrs'
import type { Db } from '../db/client'
import { concepts, reviews, variants, type Concept, type Variant } from '../db/schema'
import type { Effort, SessionItem, Settings } from '../../shared/domain'
import { calibrate } from './difficulty'
import type { FsrsService } from './fsrs'
export const SECONDS = { recall: 20, cloze: 25, mcq: 30, numeric_problem: 90, open_problem: 150, explain: 180 } as const
export interface ServedItem { item: SessionItem; noteText: string; cardJson: string; variant: Variant | null; revealed: boolean }
export class SessionService {
  private served = new Map<string, ServedItem>()
  constructor(private db: Db, private fsrs: FsrsService, private settings: () => Settings, private clock: () => Date, private refill: (id: string) => void) {}
  private key(conceptId: string, variantId: string | null) { return `${conceptId}:${variantId ?? 'static'}` }
  build(input: { effort: Effort; minutes: number }): SessionItem[] {
    this.served.clear()
    const now = this.clock(); const midnight = new Date(now); midnight.setHours(0, 0, 0, 0)
    const today = this.db.select().from(reviews).all().filter(r => r.reviewedAt >= midnight.getTime())
    const introduced = new Set(today.filter(r => this.fsrs.deserialize(r.cardStateBeforeJson).state === State.New).map(r => r.conceptId)).size
    const all = this.db.select().from(concepts).where(eq(concepts.archived, false)).orderBy(asc(concepts.createdAt)).all()
    const due = all.filter(c => c.lastReview !== null && c.due <= now.getTime()).sort((a, b) => this.retrievability(a) - this.retrievability(b))
    const fresh = all.filter(c => c.lastReview === null).slice(0, Math.max(0, this.settings().newConceptsPerDay - introduced))
    let budget = input.minutes * 60
    const result: SessionItem[] = []
    for (const concept of [...due, ...fresh]) {
      const chosen = this.choose(concept, input.effort, budget)
      if (!chosen) continue
      result.push(chosen.item); budget -= chosen.item.estimatedSeconds
      this.record(concept, chosen.item, chosen.variant)
    }
    return result
  }
  retrievability(concept: Concept) { return this.fsrs.retrievability(this.fsrs.deserialize(concept.fsrsCardJson)) }
  private choose(concept: Concept, effort: Effort, budget = Infinity, reason?: string) {
    const errors = this.db.select({ error: reviews.errorSummary }).from(reviews).where(eq(reviews.conceptId, concept.id)).orderBy(desc(reviews.reviewedAt)).limit(5).all().flatMap(r => r.error ? [r.error] : [])
    const target = calibrate({ state: concept.state, stability: concept.stability, retrievability: this.retrievability(concept) }, concept.modePref, effort, errors)
    const last = this.db.select({ variantId: reviews.variantId }).from(reviews).where(eq(reviews.conceptId, concept.id)).orderBy(desc(reviews.reviewedAt)).limit(1).get()
    const lastType = last?.variantId ? this.db.select({ type: variants.type }).from(variants).where(eq(variants.id, last.variantId)).get()?.type : last ? 'recall' : undefined
    const pool = this.db.select().from(variants).where(and(eq(variants.conceptId, concept.id), eq(variants.status, 'verified'))).all().filter(v => target.allowedTypes.includes(v.type) && SECONDS[v.type] <= budget && v.reportCount < 2)
    // Prefer unseen, then a different type, then the nearest calibrated difficulty.
    pool.sort((a, b) => Number(a.timesShown > 0) - Number(b.timesShown > 0) || Number(a.type === lastType) - Number(b.type === lastType) || Math.abs(a.difficulty - target.difficulty) - Math.abs(b.difficulty - target.difficulty) || a.timesShown - b.timesShown || a.createdAt - b.createdAt)
    const variant = pool[0] ?? null
    if (!variant && budget < SECONDS.recall) return null
    const fallback = !variant
    const why = reason ?? (concept.lastReview === null ? 'Concepto nuevo; empezamos con una perspectiva sencilla.' : `Concepto vencido; recuerdo estimado ${Math.round(this.retrievability(concept) * 100)}% y estabilidad ${concept.stability.toFixed(1)} días. Dificultad objetivo ${target.difficulty}/5; buscamos otro tipo de pregunta.`)
    const item: SessionItem = { conceptId: concept.id, variantId: variant?.id ?? null, title: concept.title, type: variant?.type ?? 'recall', answerType: variant?.answerType ?? 'self', questionMd: variant?.questionMd ?? `¿Qué recuerdas sobre **${concept.title}**?`, choices: variant?.choices ?? null, hint: variant?.hint ?? null, selectionReason: `${why}${fallback ? ' Banco sin variante adecuada: repaso directo de tu nota.' : ''}`, estimatedSeconds: SECONDS[variant?.type ?? 'recall'], effort }
    return { item, variant }
  }
  private record(concept: Concept, item: SessionItem, variant: Variant | null) {
    this.served.set(this.key(concept.id, item.variantId), { item, noteText: concept.noteText, cardJson: concept.fsrsCardJson, variant, revealed: false })
    if (variant) this.db.update(variants).set({ timesShown: variant.timesShown + 1 }).where(eq(variants.id, variant.id)).run()
    else this.refill(concept.id)
  }
  reinforcement(conceptId: string, effort: Effort, reason: string) {
    const concept = this.db.select().from(concepts).where(eq(concepts.id, conceptId)).get()
    if (!concept || concept.archived) return null
    const chosen = this.choose(concept, effort, Infinity, reason)
    if (!chosen) return null
    this.record(concept, chosen.item, chosen.variant)
    return chosen.item
  }
  getServed(conceptId: string, variantId: string | null) {
    const served = this.served.get(this.key(conceptId, variantId))
    if (!served) throw new Error('Esta pregunta ya se respondió o la sesión cambió.')
    const current = this.db.select().from(concepts).where(eq(concepts.id, conceptId)).get()
    if (!current || current.noteText !== served.noteText || current.fsrsCardJson !== served.cardJson) throw new Error('El concepto cambió. Inicia una nueva sesión.')
    if (variantId) { const variant = this.db.select().from(variants).where(eq(variants.id, variantId)).get(); if (!variant || variant.status !== 'verified' || variant.reportCount >= 2) throw new Error('La variante ya no está disponible. Inicia otra sesión.') }
    return served
  }
  consume(conceptId: string, variantId: string | null) { this.served.delete(this.key(conceptId, variantId)) }
  reveal(conceptId: string, variantId: string | null) {
    const served = this.getServed(conceptId, variantId); served.revealed = true
    return { correctAnswer: served.variant?.correctAnswer ?? served.noteText, solutionStepsMd: served.variant?.solutionStepsMd ?? '', noteText: served.noteText }
  }
}
