import type { Db } from '../db/client'
import { concepts, llmCalls, reviews } from '../db/schema'
import type { FsrsService } from './fsrs'
import type { Stats } from '../../shared/domain'
// Illustrative blended rates, not a quote for a specific OpenAI model.
export const ESTIMATE_USD_PER_MILLION = {
  generate: { input: 0.5, output: 2 },
  verify: { input: 5, output: 15 },
} as const
export class StatsService {
  constructor(
    private db: Db,
    private fsrs: FsrsService,
    private clock: () => Date,
  ) {}
  get(): Stats {
    const now = this.clock()
    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    const all = this.db
      .select()
      .from(concepts)
      .all()
      .filter((c) => !c.archived)
    const history = this.db.select().from(reviews).all()
    const studied = all.filter((c) => c.lastReview !== null)
    const costs = new Map<string, Stats['llmCosts'][number]>()
    for (const call of this.db.select().from(llmCalls).all()) {
      const group = costs.get(call.purpose) ?? {
        purpose: call.purpose,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0,
      }
      const rates = ['generate', 'diagnose', 'suggest-edges'].includes(call.purpose)
        ? ESTIMATE_USD_PER_MILLION.generate
        : ESTIMATE_USD_PER_MILLION.verify
      group.calls++
      group.inputTokens += call.inputTokens
      group.outputTokens += call.outputTokens
      if (call.model !== 'FAKE_LLM')
        group.estimatedUsd +=
          (call.inputTokens * rates.input + call.outputTokens * rates.output) / 1e6
      costs.set(call.purpose, group)
    }
    return {
      dueCount: all.filter((c) => c.due <= now.getTime()).length,
      reviewsToday: history.filter((r) => r.reviewedAt >= midnight.getTime()).length,
      retentionEstimate: studied.length
        ? studied.reduce(
            (sum, c) => sum + this.fsrs.retrievability(this.fsrs.deserialize(c.fsrsCardJson)),
            0,
          ) / studied.length
        : 0,
      errors: history
        .sort((a, b) => b.reviewedAt - a.reviewedAt)
        .flatMap((r) => (r.errorSummary ? [r.errorSummary] : []))
        .slice(0, 10),
      llmCosts: [...costs.values()],
    }
  }
}
