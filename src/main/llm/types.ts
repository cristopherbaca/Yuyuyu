import type { z } from 'zod'
import type { VariantContent, VariantType } from '../../shared/domain'
export interface GenerateInput {
  conceptId: string
  title: string
  noteText: string
  targetType: VariantType
  bloomLevel: VariantContent['bloomLevel']
  difficulty: number
  recentErrors: string[]
  nextAngleHint: string | null
  existingQuestions: string[]
}
export interface BlindInput {
  questionMd: string
  choices: string[] | null
  noteText: string
  answerType: VariantContent['answerType']
}
export interface JudgeInput {
  blindAnswer: string
  referenceSolution: string
  correctAnswer: string
  rubric: string[]
  noteText: string
}
export interface GradeInput {
  questionMd: string
  userAnswer: string
  correctAnswer: string
  solutionStepsMd: string
  rubric: string[]
  noteText: string
}
export interface DiagnoseInput {
  title: string
  noteText: string
  userAnswer: string
  feedback: string
  missingCriteria: string[]
}
export interface SuggestInput {
  newConcept: { id: string; title: string; noteText: string }
  existing: { id: string; title: string; summary: string }[]
}
export type LlmRequest =
  | { purpose: 'generate'; input: GenerateInput }
  | { purpose: 'blind-solve'; input: BlindInput }
  | { purpose: 'judge'; input: JudgeInput }
  | { purpose: 'grade'; input: GradeInput }
  | { purpose: 'diagnose'; input: DiagnoseInput }
  | { purpose: 'suggest-edges'; input: SuggestInput }
export interface Llm {
  available(): boolean
  complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T>
}
