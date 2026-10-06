import { z } from 'zod'
import {
  effortSchema,
  idSchema,
  modeSchema,
  ratingSchema,
  settingsSchema,
  verdictSchema,
  type ConceptView,
  type ConceptDetail,
  type Result,
  type SessionItem,
  type ReviewResult,
  type AnswerReveal,
  type Stats,
  type Settings,
  type LlmStatus,
} from './domain'
export const createConceptSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    noteText: z.string().trim().min(1).max(40000),
    modePref: modeSchema.default('both'),
  })
  .strict()
export const updateConceptSchema = z
  .object({
    noteText: z.string().trim().min(1).max(40000).optional(),
    modePref: modeSchema.optional(),
  })
  .strict()
export const submitReviewSchema = z
  .object({
    conceptId: idSchema,
    variantId: idSchema.nullable(),
    userAnswer: z.string().max(20000).optional(),
    selfRating: ratingSchema.optional(),
    responseTimeMs: z.number().int().min(0).max(86400000),
    hintUsed: z.boolean(),
  })
  .strict()
export const ipcSchemas = {
  'concepts:create': createConceptSchema,
  'concepts:list': z.null(),
  'concepts:get': idSchema,
  'concepts:update': z.object({ id: idSchema, changes: updateConceptSchema }).strict(),
  'concepts:delete': idSchema,
  'concepts:generate': z.object({ id: idSchema, n: z.number().int().min(1).max(30) }).strict(),
  'edges:confirm': idSchema,
  'edges:reject': idSchema,
  'session:build': z
    .object({ effort: effortSchema, minutes: z.number().int().min(1).max(120) })
    .strict(),
  'reviews:submit': submitReviewSchema,
  'reviews:reveal': z.object({ conceptId: idSchema, variantId: idSchema.nullable() }).strict(),
  'reviews:override': z.object({ reviewId: idSchema, verdict: verdictSchema }).strict(),
  'variants:report': idSchema,
  'jobs:refillNow': z.null(),
  'stats:get': z.null(),
  'data:export': z.null(),
  'data:seed': z.null(),
  'settings:get': z.null(),
  'settings:set': settingsSchema.partial(),
  'settings:setApiKey': z.string().trim().max(500),
  'app:openExternal': z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:', 'Solo enlaces HTTPS'),
} as const
export type Channel = keyof typeof ipcSchemas
export type Payload<C extends Channel> = z.input<(typeof ipcSchemas)[C]>
export interface PublicSettings extends Settings {
  apiKeySet: boolean
  secretWarning: string | null
}
export interface Responses {
  'concepts:create': ConceptView
  'concepts:list': ConceptView[]
  'concepts:get': ConceptDetail
  'concepts:update': ConceptView
  'concepts:delete': null
  'concepts:generate': { queued: boolean }
  'edges:confirm': null
  'edges:reject': null
  'session:build': SessionItem[]
  'reviews:submit': ReviewResult
  'reviews:reveal': AnswerReveal
  'reviews:override': {
    verdict: z.infer<typeof verdictSchema>
    rating: number
    nextDue: number
    appliedToConcept: boolean
    followUp: SessionItem | null
  }
  'variants:report': { reportCount: number; status: string }
  'jobs:refillNow': { queued: boolean }
  'stats:get': Stats
  'data:export': { canceled: boolean }
  'data:seed': { created: number }
  'settings:get': PublicSettings
  'settings:set': PublicSettings
  'settings:setApiKey': PublicSettings
  'app:openExternal': null
}
type Call<C extends Channel> = (payload: Payload<C>) => Promise<Result<Responses[C]>>
type NoInput<C extends Channel> = () => Promise<Result<Responses[C]>>
export interface Api {
  concepts: {
    create: Call<'concepts:create'>
    list: NoInput<'concepts:list'>
    get: Call<'concepts:get'>
    update: (
      id: string,
      changes: Payload<'concepts:update'>['changes'],
    ) => Promise<Result<ConceptView>>
    delete: Call<'concepts:delete'>
    generate: (id: string, n: number) => Promise<Result<Responses['concepts:generate']>>
  }
  edges: { confirm: Call<'edges:confirm'>; reject: Call<'edges:reject'> }
  session: { build: Call<'session:build'> }
  reviews: {
    submit: Call<'reviews:submit'>
    reveal: Call<'reviews:reveal'>
    override: (
      reviewId: string,
      verdict: Payload<'reviews:override'>['verdict'],
    ) => Promise<Result<Responses['reviews:override']>>
  }
  variants: { report: Call<'variants:report'> }
  jobs: { refillNow: NoInput<'jobs:refillNow'> }
  stats: { get: NoInput<'stats:get'> }
  data: { export: NoInput<'data:export'>; seed: NoInput<'data:seed'> }
  settings: {
    get: NoInput<'settings:get'>
    set: Call<'settings:set'>
    setApiKey: Call<'settings:setApiKey'>
  }
  openExternal: Call<'app:openExternal'>
  onPoolUpdated: (listener: (conceptId: string) => void) => () => void
  onLlmStatus: (listener: (status: LlmStatus) => void) => () => void
}
export const eventSchemas = {
  'pool:updated': idSchema,
  'llm:status': z.enum(['idle', 'generating', 'offline', 'no-key']),
} as const
