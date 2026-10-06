import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import type { Mode, VariantType, Verdict, VariantContent } from '../../shared/domain'
export const concepts = sqliteTable(
  'concepts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    noteText: text('note_text').notNull(),
    modePref: text('mode_pref').$type<Mode>().notNull().default('both'),
    fsrsCardJson: text('fsrs_card_json').notNull(),
    due: integer('due').notNull(),
    lastReview: integer('last_review'),
    state: integer('state').notNull(),
    stability: real('stability').notNull(),
    difficulty: real('difficulty').notNull(),
    nextAngleHint: text('next_angle_hint'),
    createdAt: integer('created_at').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('concept_due').on(t.due)],
)
export const edges = sqliteTable('concept_edges', {
  id: text('id').primaryKey(),
  fromId: text('from_id')
    .notNull()
    .references(() => concepts.id, { onDelete: 'cascade' }),
  toId: text('to_id')
    .notNull()
    .references(() => concepts.id, { onDelete: 'cascade' }),
  relation: text('relation').$type<'prerequisite_of' | 'application_of' | 'related'>().notNull(),
  status: text('status').$type<'suggested' | 'confirmed' | 'rejected'>().notNull(),
  rationale: text('rationale').notNull(),
})
export const variants = sqliteTable(
  'variants',
  {
    id: text('id').primaryKey(),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    type: text('type').$type<VariantType>().notNull(),
    bloomLevel: text('bloom_level').$type<VariantContent['bloomLevel']>().notNull(),
    difficulty: integer('difficulty').notNull(),
    questionMd: text('question_md').notNull(),
    choices: text('choices', { mode: 'json' }).$type<string[] | null>(),
    answerType: text('answer_type').$type<VariantContent['answerType']>().notNull(),
    correctAnswer: text('correct_answer').notNull(),
    acceptedAnswers: text('accepted_answers', { mode: 'json' }).$type<string[]>().notNull(),
    solutionStepsMd: text('solution_steps_md').notNull(),
    rubric: text('rubric', { mode: 'json' }).$type<string[]>().notNull(),
    hint: text('hint'),
    anchorQuote: text('anchor_quote').notNull(),
    status: text('status').$type<'pending' | 'verified' | 'rejected' | 'retired'>().notNull(),
    verificationReport: text('verification_report', { mode: 'json' })
      .$type<{ consistent: boolean; issues: string[] }>()
      .notNull(),
    timesShown: integer('times_shown').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('variant_pool').on(t.conceptId, t.status)],
)
export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').references(() => variants.id, { onDelete: 'set null' }),
    userAnswer: text('user_answer').notNull(),
    selfRating: integer('self_rating'),
    verdict: text('verdict').$type<Verdict>().notNull(),
    rating: integer('rating').notNull(),
    graderReasoning: text('grader_reasoning').notNull(),
    responseTimeMs: integer('response_time_ms').notNull(),
    hintUsed: integer('hint_used', { mode: 'boolean' }).notNull(),
    userOverrideVerdict: text('user_override_verdict').$type<Verdict>(),
    errorSummary: text('error_summary'),
    selectionReason: text('selection_reason').notNull(),
    cardStateBeforeJson: text('card_state_before_json').notNull(),
    cardStateAfterJson: text('card_state_after_json').notNull(),
    reviewedAt: integer('reviewed_at').notNull(),
  },
  (t) => [index('review_concept').on(t.conceptId, t.reviewedAt)],
)
export const llmCalls = sqliteTable('llm_calls', {
  id: text('id').primaryKey(),
  purpose: text('purpose').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  createdAt: integer('created_at').notNull(),
})
export type Concept = typeof concepts.$inferSelect
export type Variant = typeof variants.$inferSelect
export type Review = typeof reviews.$inferSelect
