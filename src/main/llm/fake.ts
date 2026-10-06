import type { z } from 'zod'
import type { VariantContent } from '../../shared/domain'
import type { GenerateInput, Llm, LlmRequest } from './types'
import { normalize, numericValue } from '../services/grading'
export type FakeScenario = 'good' | 'hallucinated' | 'unsupported'
export class FakeLlm implements Llm {
  constructor(private scenario: FakeScenario = 'good') {}
  available() {
    return true
  }
  async complete<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
    let output: unknown
    switch (request.purpose) {
      case 'generate':
        output = this.generate(request.input)
        break
      case 'blind-solve': {
        const { questionMd, choices, noteText, answerType } = request.input
        let answer =
          noteText
            .split(/\n/)
            .find((line) => line.trim() && !line.startsWith('#'))
            ?.trim() ?? noteText
        if (answerType === 'mcq')
          answer = String(choices?.findIndex((choice) => noteText.includes(choice)) ?? -1)
        if (answerType === 'text_exact')
          answer =
            /«([^»]+)»/.exec(noteText)?.[1] ?? noteText.match(/[\p{L}\p{N}]+/u)?.[0] ?? noteText
        if (answerType === 'numeric') {
          const expression = /`([^`]+)`/.exec(questionMd)?.[1] ?? ''
          answer = String(numericValue(expression) ?? 'unsupported')
        }
        output = { answer }
        break
      }
      case 'judge': {
        const consistent =
          this.scenario !== 'hallucinated' &&
          normalize(request.input.blindAnswer).includes(normalize(request.input.correctAnswer))
        output = {
          consistent,
          issues: consistent ? [] : ['La respuesta independiente contradice la referencia.'],
        }
        break
      }
      case 'grade': {
        const answer = normalize(request.input.userAnswer)
        const reference = normalize(request.input.correctAnswer)
        const keywords = [...new Set(reference.match(/[\p{L}\p{N}]{4,}/gu) ?? [])]
        const coverage = keywords.length
          ? keywords.filter((word) => answer.includes(word)).length / keywords.length
          : Number(answer === reference)
        const verdict =
          answer.includes(reference) || coverage > 0.8
            ? 'pass'
            : coverage > 0.3
              ? 'partial'
              : 'fail'
        output = {
          verdict,
          reasoning:
            verdict === 'pass'
              ? 'La respuesta recoge los criterios de la nota.'
              : 'Compara tu explicación con la nota y completa los criterios.',
          missingCriteria: verdict === 'pass' ? [] : request.input.rubric,
        }
        break
      }
      case 'diagnose':
        output = {
          errorSummary:
            `Revisar la relación central de ${request.input.title}: la respuesta no satisface la solución.`.slice(
              0,
              300,
            ),
        }
        break
      case 'suggest-edges':
        output = { edges: [] }
        break
    }
    return schema.parse(output)
  }
  private generate(input: GenerateInput) {
    if (this.scenario === 'unsupported') return { unsupported: true, variant: null }
    const note = input.noteText
    const anchor =
      note
        .split(/\n/)
        .find((line) => line.trim() && !line.startsWith('#'))
        ?.trim() ?? note.trim()
    const n = input.existingQuestions.length + 1
    const spanish = /[áéíóúñ¿]|\b(teorema|raíz|cuadrada|es|el|los|para|nota|pretérito)\b/i.test(
      note,
    )
    const lead = spanish ? `Enfoque ${n}` : `Angle ${n}`
    const token = /«([^»]+)»/.exec(note)?.[1] ?? note.match(/[\p{L}\p{N}]+/u)?.[0] ?? anchor
    const variant: VariantContent = {
      type: input.targetType,
      answerType: 'self',
      bloomLevel: input.bloomLevel,
      difficulty: input.difficulty,
      questionMd: '',
      choices: null,
      correctAnswer: anchor,
      acceptedAnswers: [],
      solutionStepsMd: anchor,
      rubric: [],
      hint: spanish
        ? 'Revisa la relación principal de tu nota.'
        : 'Consider the central relation in your note.',
      anchorQuote: anchor,
    }
    switch (input.targetType) {
      case 'recall':
        variant.questionMd = spanish
          ? `${lead}: ¿Qué afirma la nota sobre **${input.title}**?`
          : `${lead}: What does the note say about **${input.title}**?`
        break
      case 'cloze':
        variant.answerType = 'text_exact'
        variant.correctAnswer = token
        variant.questionMd = `${lead}: ${spanish ? 'Completa la palabra de la nota' : 'Complete the word from the note'}: ${anchor.replace(token, '_____')}`
        break
      case 'mcq': {
        const correctIndex = n % 3
        const choices = spanish
          ? [
              'La nota afirma lo contrario de su relación central.',
              'La nota dice que no existe ninguna relación.',
              'La nota no permite recordar ninguna afirmación.',
            ]
          : [
              'The note claims the opposite of its central relation.',
              'The note says there is no relation.',
              'The note supports no statement.',
            ]
        choices[correctIndex] = anchor
        variant.answerType = 'mcq'
        variant.choices = choices
        variant.correctAnswer = String(correctIndex)
        variant.questionMd = `${lead}: ${spanish ? '¿Qué afirmación aparece literalmente en la nota?' : 'Which statement appears literally in the note?'}`
        break
      }
      case 'numeric_problem': {
        let expression: string | null = null
        if (
          /pitágoras|pythagor/i.test(`${input.title} ${note}`) &&
          /a\^?2|a²/i.test(note) &&
          /b\^?2|b²/i.test(note)
        ) {
          const a = 3 * n
          const b = 4 * n
          expression = `sqrt(${a}^2 + ${b}^2)`
          variant.questionMd = spanish
            ? `${lead}: Un triángulo rectángulo tiene catetos de ${a} y ${b}. ¿Cuánto mide la hipotenusa? Aplica \`${expression}\`.`
            : `${lead}: A right triangle has legs ${a} and ${b}. Find its hypotenuse using \`${expression}\`.`
        } else if (/raíz|square root|sqrt/i.test(note)) {
          expression = `sqrt(${(n + 2) ** 2})`
          variant.questionMd = `${lead}: ${spanish ? 'Calcula la raíz principal' : 'Compute the principal root'}: \`${expression}\`.`
        }
        if (!expression) return { unsupported: true, variant: null }
        variant.answerType = 'numeric'
        variant.correctAnswer =
          this.scenario === 'hallucinated' ? '999999' : String(numericValue(expression))
        variant.solutionStepsMd = `${expression} = ${variant.correctAnswer}`
        break
      }
      case 'open_problem':
      case 'explain':
        variant.answerType = 'open'
        variant.questionMd = spanish
          ? `${lead}: Explica con tus palabras la afirmación central de **${input.title}** y cómo se aplica, usando solo la nota.`
          : `${lead}: Explain the central claim of **${input.title}** and how it applies, using only the note.`
        variant.rubric = [
          spanish ? `Describe correctamente: ${anchor}` : `Correctly describe: ${anchor}`,
        ]
        break
    }
    if (this.scenario === 'hallucinated' && input.targetType !== 'numeric_problem')
      variant.correctAnswer = 'Una afirmación inventada y contradictoria.'
    return { unsupported: false, variant }
  }
}
