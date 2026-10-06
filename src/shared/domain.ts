import { z } from 'zod'
export const modeSchema = z.enum(['simple', 'problem', 'both'])
export const effortSchema = z.enum(['quick', 'normal', 'deep'])
export const typeSchema = z.enum(['recall', 'cloze', 'mcq', 'numeric_problem', 'open_problem', 'explain'])
export const bloomSchema = z.enum(['remember', 'understand', 'apply', 'analyze'])
export const answerTypeSchema = z.enum(['self', 'text_exact', 'mcq', 'numeric', 'open'])
export const verdictSchema = z.enum(['fail', 'partial', 'pass'])
export const ratingSchema = z.number().int().min(1).max(4)
export const idSchema = z.string().uuid()
export const settingsSchema = z.object({
  modelGenerate: z.string().max(150).default(''), modelVerify: z.string().max(150).default(''),
  targetPoolSize: z.number().int().min(1).max(30).default(5), newConceptsPerDay: z.number().int().min(0).max(100).default(10),
  desiredRetention: z.number().min(0.7).max(0.99).default(0.9), fakeLlm: z.boolean().default(false)
}).strict()
export const variantContentSchema = z.object({
  type: typeSchema, bloomLevel: bloomSchema, difficulty: z.number().int().min(1).max(5),
  questionMd: z.string().min(1).max(20000), choices: z.array(z.string().min(1)).min(2).max(8).nullable(),
  answerType: answerTypeSchema, correctAnswer: z.string().min(1).max(20000),
  acceptedAnswers: z.array(z.string()).max(30), solutionStepsMd: z.string().max(20000),
  rubric: z.array(z.string().min(1)).max(20), hint: z.string().max(4000).nullable(), anchorQuote: z.string().min(1).max(20000)
}).strict()
export const generationSchema = z.object({ unsupported: z.boolean(), variant: variantContentSchema.nullable() }).strict()
export const blindSchema = z.object({ answer: z.string() }).strict()
export const judgeSchema = z.object({ consistent: z.boolean(), issues: z.array(z.string()) }).strict()
export const gradeSchema = z.object({ verdict: verdictSchema, reasoning: z.string(), missingCriteria: z.array(z.string()) }).strict()
export const diagnosisSchema = z.object({ errorSummary: z.string().min(1).max(300) }).strict()
export const edgeSuggestionsSchema = z.object({ edges: z.array(z.object({ fromId: idSchema, toId: idSchema, relation: z.enum(['prerequisite_of', 'application_of', 'related']), rationale: z.string().max(2000) }).strict()).max(20) }).strict()
export type Mode = z.infer<typeof modeSchema>
export type Effort = z.infer<typeof effortSchema>
export type VariantType = z.infer<typeof typeSchema>
export type Verdict = z.infer<typeof verdictSchema>
export type Settings = z.infer<typeof settingsSchema>
export type VariantContent = z.infer<typeof variantContentSchema>
export type Grade = z.infer<typeof gradeSchema>
export type LlmStatus = 'idle' | 'generating' | 'offline' | 'no-key'
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
export interface ConceptView { id: string; title: string; noteText: string; modePref: Mode; due: number; state: number; stability: number; difficulty: number; lastReview: number | null; nextAngleHint: string | null; retrievability: number; poolSize: number }
export interface EdgeView { id: string; fromId: string; toId: string; relation: string; status: string; rationale: string }
export interface ReviewView { id: string; variantId: string | null; verdict: Verdict; rating: number; reviewedAt: number; errorSummary: string | null; graderReasoning: string; userOverrideVerdict: Verdict | null }
export interface ConceptDetail { concept: ConceptView; edges: EdgeView[]; reviews: ReviewView[]; pool: { verified: number; rejected: number; retired: number } }
export interface SessionItem { conceptId: string; variantId: string | null; title: string; type: VariantType; answerType: VariantContent['answerType']; questionMd: string; choices: string[] | null; hint: string | null; selectionReason: string; estimatedSeconds: number; effort: Effort }
export interface AnswerReveal { correctAnswer: string; solutionStepsMd: string; noteText: string }
export interface ReviewResult extends AnswerReveal { reviewId: string; verdict: Verdict; rating: number; feedback: string; missingCriteria: string[]; nextDue: number; followUp: SessionItem | null }
export interface Stats { dueCount: number; reviewsToday: number; retentionEstimate: number; errors: string[]; llmCosts: { purpose: string; calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number }[] }
