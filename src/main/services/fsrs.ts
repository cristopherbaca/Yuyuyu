import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs'
import { z } from 'zod'
import type { VariantType, Verdict } from '../../shared/domain'
export type FsrsRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy
const dateSchema = z.coerce.date()
const cardSchema = z.object({ due: dateSchema, stability: z.number(), difficulty: z.number(), elapsed_days: z.number(), scheduled_days: z.number(), learning_steps: z.number(), reps: z.number(), lapses: z.number(), state: z.nativeEnum(State), last_review: dateSchema.optional() })
export const EASY_THRESHOLDS_MS: Record<VariantType, number> = { recall: 8000, cloze: 10000, mcq: 12000, numeric_problem: 30000, open_problem: 45000, explain: 60000 }
export function ratingFromVerdict(verdict: Verdict, type: VariantType, responseTimeMs: number, hintUsed: boolean): FsrsRating {
  if (verdict === 'fail') return Rating.Again
  if (verdict === 'partial') return Rating.Hard
  return !hintUsed && responseTimeMs < EASY_THRESHOLDS_MS[type] ? Rating.Easy : Rating.Good
}
export function verdictFromRating(rating: number): Verdict { return rating === 1 ? 'fail' : rating === 2 ? 'partial' : 'pass' }
export class FsrsService {
  constructor(private retention: () => number, private clock: () => Date) {}
  create() { return createEmptyCard(this.clock()) }
  serialize(card: Card) { return JSON.stringify(card) }
  deserialize(json: string): Card { return cardSchema.parse(JSON.parse(json) as unknown) }
  schedule(card: Card, rating: FsrsRating, at = this.clock()) { return fsrs({ request_retention: this.retention(), enable_fuzz: false }).next(card, at, rating).card }
  override(beforeJson: string, rating: FsrsRating, reviewedAt: Date) { return this.schedule(this.deserialize(beforeJson), rating, reviewedAt) }
  retrievability(card: Card, at = this.clock()) { return card.state === State.New ? 0 : fsrs({ request_retention: this.retention(), enable_fuzz: false }).get_retrievability(card, at, false) }
  columns(card: Card) { return { fsrsCardJson: this.serialize(card), due: card.due.getTime(), lastReview: card.last_review?.getTime() ?? null, state: card.state, stability: card.stability, difficulty: card.difficulty } }
}
