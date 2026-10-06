import { all, create } from 'mathjs'
import { gradeSchema, type Grade, type VariantContent } from '../../shared/domain'
import type { Llm } from '../llm/types'
const math = create(all, {})
export function normalize(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim() }
export function numericValue(expression: string): number | null {
  if (expression.length > 200) return null
  try {
    const node = math.parse(expression.trim().replace(/^(\d+),(\d+)$/, '$1.$2'))
    let safe = true
    node.traverse(child => {
      // Only bounded arithmetic expressions and two vetted numeric functions.
      if (!['ConstantNode', 'OperatorNode', 'ParenthesisNode', 'FunctionNode', 'SymbolNode'].includes(child.type)) safe = false
      if (child.type === 'SymbolNode' && !['sqrt', 'abs', 'pi', 'e'].includes(child.toString())) safe = false
      if (child.type === 'FunctionNode' && !/^(sqrt|abs)\(/.test(child.toString())) safe = false
      if (child.type === 'OperatorNode' && !['+', '-', '*', '/', '^'].includes((child as import('mathjs').OperatorNode).op)) safe = false
    })
    if (!safe) return null
    const value: unknown = node.evaluate()
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e100 ? value : null
  } catch { return null }
}
export function numericEqual(a: string, b: string, tolerance = 1e-6) { const x = numericValue(a); const y = numericValue(b); return x !== null && y !== null && Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(x), Math.abs(y)) }
export function closedEqual(variant: Pick<VariantContent, 'answerType' | 'correctAnswer' | 'acceptedAnswers' | 'choices'>, answer: string) {
  if (variant.answerType === 'numeric') return numericEqual(variant.correctAnswer, answer)
  if (variant.answerType === 'mcq') return /^\d+$/.test(answer.trim()) && Number(answer.trim()) >= 0 && Number(answer.trim()) < (variant.choices?.length ?? 0) && Number(answer.trim()) === Number(variant.correctAnswer)
  return [variant.correctAnswer, ...variant.acceptedAnswers].some(candidate => normalize(candidate) === normalize(answer))
}
export class GradingService {
  constructor(private llm: Llm) {}
  async grade(variant: VariantContent, answer: string, noteText: string): Promise<Grade> {
    if (variant.answerType === 'self') throw new Error('Esta variante requiere autoevaluación.')
    if (variant.answerType !== 'open') return { verdict: closedEqual(variant, answer) ? 'pass' : 'fail', reasoning: closedEqual(variant, answer) ? 'La respuesta coincide con la solución verificada.' : 'La respuesta no coincide con la solución verificada.', missingCriteria: [] }
    return this.llm.complete({ purpose: 'grade', input: { questionMd: variant.questionMd, userAnswer: answer, correctAnswer: variant.correctAnswer, solutionStepsMd: variant.solutionStepsMd, rubric: variant.rubric, noteText } }, gradeSchema)
  }
}
