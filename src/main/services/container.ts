import type { Db } from '../db/client'
import type { Llm } from '../llm/types'
import { SettingsService } from './settings'
import { FsrsService } from './fsrs'
import { GenerationService } from './generation'
import { GradingService } from './grading'
import { SessionService } from './session'
import { GraphService } from './graph'
import { ReviewService } from './reviews'
import { ConceptService } from './concepts'
import { VariantService } from './variants'
import { JobService } from './jobs'
import { DataService } from './data'
import { StatsService } from './stats'
export function createServices(
  db: Db,
  settings: SettingsService,
  llm: Llm,
  clock: () => Date,
  updated: (id: string) => void,
) {
  const fsrs = new FsrsService(() => settings.get().desiredRetention, clock)
  const generation = new GenerationService(db, llm, fsrs, () => settings.get(), clock, updated)
  const jobs = new JobService(generation)
  const session = new SessionService(
    db,
    fsrs,
    () => settings.get(),
    clock,
    (id) => {
      jobs.concept(id)
    },
  )
  const graph = new GraphService(db, llm, fsrs, session, generation, clock)
  const concepts = new ConceptService(db, fsrs, generation, clock, (id) => {
    void graph.suggest(id)
  })
  return {
    settings,
    fsrs,
    generation,
    jobs,
    session,
    graph,
    concepts,
    reviews: new ReviewService(
      db,
      fsrs,
      session,
      new GradingService(llm),
      graph,
      llm,
      clock,
      (id) => {
        jobs.concept(id)
      },
    ),
    variants: new VariantService(db, updated, (id) => {
      jobs.concept(id)
    }),
    data: new DataService(db, concepts),
    stats: new StatsService(db, fsrs, clock),
  }
}
export type Services = ReturnType<typeof createServices>
