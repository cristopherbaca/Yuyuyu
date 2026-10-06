import { distance } from 'fastest-levenshtein'
import { blindSchema, judgeSchema, type VariantContent } from '../../shared/domain'
import type { Llm } from '../llm/types'
import { closedEqual, normalize, numericEqual, numericValue } from './grading'
export interface VerificationReport {
  consistent: boolean
  issues: string[]
}
export interface DeterministicVerifier {
  supports(variant: VariantContent): boolean
  verify(variant: VariantContent, blindAnswer: string): VerificationReport
}
export class MathVerifier implements DeterministicVerifier {
  supports(variant: VariantContent) {
    return variant.type === 'numeric_problem'
  }
  verify(variant: VariantContent, blindAnswer: string) {
    const consistent =
      numericValue(variant.correctAnswer) !== null &&
      numericEqual(variant.correctAnswer, blindAnswer)
    return {
      consistent,
      issues: consistent ? [] : ['La comprobación numérica independiente no coincide.'],
    }
  }
}
export function groundingScore(quote: string, note: string) {
  const target = normalize(quote)
  const source = normalize(note)
  if (!target || !source || target.length > source.length * 1.1) return 0
  if (source.includes(target)) return 100
  // Bounded token-aligned sliding windows: partial ratio without quadratic scans on long notes.
  const starts = [
    0,
    ...Array.from(source.matchAll(/\s+/g), (match) => match.index + match[0].length),
  ]
  let best = 0
  for (const start of starts.slice(0, 10000)) {
    const candidate = source.slice(start, start + target.length)
    if (candidate.length < target.length * 0.9) continue
    const score =
      100 * (1 - distance(candidate, target) / Math.max(candidate.length, target.length))
    best = Math.max(best, score)
    if (best >= 90) break
  }
  return best
}
export function variantShapeIssues(variant: VariantContent) {
  const expected = {
    recall: 'self',
    cloze: 'text_exact',
    mcq: 'mcq',
    numeric_problem: 'numeric',
    open_problem: 'open',
    explain: 'open',
  } as const
  const issues: string[] = []
  if (variant.answerType !== expected[variant.type]) issues.push('Tipo de respuesta incompatible.')
  if (
    variant.type === 'mcq' &&
    (!variant.choices ||
      new Set(variant.choices.map(normalize)).size !== variant.choices.length ||
      !/^\d+$/.test(variant.correctAnswer) ||
      Number(variant.correctAnswer) >= variant.choices.length)
  )
    issues.push('Opciones o índice MCQ inválidos.')
  if (variant.answerType === 'open' && !variant.rubric.length)
    issues.push('Falta una rúbrica explícita.')
  if (variant.type !== 'mcq' && variant.choices !== null)
    issues.push('Las opciones solo corresponden a MCQ.')
  return issues
}
export class VerificationService {
  constructor(
    private llm: Llm,
    private hooks: DeterministicVerifier[] = [new MathVerifier()],
  ) {}
  async verify(variant: VariantContent, noteText: string): Promise<VerificationReport> {
    const issues = variantShapeIssues(variant)
    if (groundingScore(variant.anchorQuote, noteText) < 90)
      issues.push('La cita de apoyo no aparece en la nota (umbral 90%).')
    if (issues.length) return { consistent: false, issues }
    // Explicit projection: neither answer, steps, rubric nor hints go to the blind solver.
    const blind = await this.llm.complete(
      {
        purpose: 'blind-solve',
        input: {
          questionMd: variant.questionMd,
          choices: variant.choices,
          noteText,
          answerType: variant.answerType,
        },
      },
      blindSchema,
    )
    if (variant.answerType === 'open' || variant.answerType === 'self') {
      const judged = await this.llm.complete(
        {
          purpose: 'judge',
          input: {
            blindAnswer: blind.answer,
            referenceSolution: variant.solutionStepsMd,
            correctAnswer: variant.correctAnswer,
            rubric: variant.rubric,
            noteText,
          },
        },
        judgeSchema,
      )
      if (!judged.consistent)
        issues.push(
          ...(judged.issues.length ? judged.issues : ['El juez detectó una inconsistencia.']),
        )
    } else if (!closedEqual(variant, blind.answer))
      issues.push('La solución a ciegas no coincide con la respuesta propuesta.')
    for (const hook of this.hooks)
      if (hook.supports(variant)) {
        const result = hook.verify(variant, blind.answer)
        if (!result.consistent) issues.push(...result.issues)
      }
    return { consistent: issues.length === 0, issues }
  }
}
