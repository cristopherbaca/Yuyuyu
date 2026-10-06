import { State } from 'ts-fsrs'
import type { Mode, Effort, VariantType, VariantContent } from '../../shared/domain'
export const THRESHOLDS = {
  fragileRetrievability: 0.7,
  growingStability: 14,
  strongStability: 60,
  prerequisiteRetrievability: 0.8,
} as const
export const MODE_TYPES: Record<Mode, VariantType[]> = {
  simple: ['recall', 'cloze', 'mcq'],
  problem: ['mcq', 'numeric_problem', 'open_problem'],
  both: ['recall', 'cloze', 'mcq', 'numeric_problem', 'open_problem', 'explain'],
}
export const EFFORT_TYPES: Record<Effort, VariantType[]> = {
  quick: ['recall', 'cloze', 'mcq'],
  normal: ['recall', 'cloze', 'mcq', 'numeric_problem'],
  deep: ['recall', 'cloze', 'mcq', 'numeric_problem', 'open_problem', 'explain'],
}
export function allowedTypes(mode: Mode, effort: Effort) {
  const intersection = EFFORT_TYPES[effort].filter((type) => MODE_TYPES[mode].includes(type))
  return intersection.length ? intersection : EFFORT_TYPES[effort]
}
export interface DifficultyState {
  state: number
  stability: number
  retrievability: number
}
export function calibrate(
  state: DifficultyState,
  mode: Mode,
  effort: Effort,
  recentErrors: readonly string[] = [],
) {
  const types = allowedTypes(mode, effort)
  let bloomLevel: VariantContent['bloomLevel'] = 'understand'
  let difficulty = 2
  if (state.state !== State.Review || state.retrievability < THRESHOLDS.fragileRetrievability) {
    bloomLevel = state.state === State.New ? 'remember' : 'understand'
    difficulty = state.state === State.New ? 1 : 2
  } else if (state.stability >= THRESHOLDS.strongStability) {
    bloomLevel = 'analyze'
    difficulty = 5
  } else if (state.stability >= THRESHOLDS.growingStability) {
    bloomLevel = 'apply'
    difficulty = 4
  } else {
    bloomLevel = state.stability < 7 ? 'understand' : 'apply'
    difficulty = state.stability < 7 ? 2 : 3
  }
  if (recentErrors.length) difficulty = Math.max(1, difficulty - 1)
  const preferred =
    difficulty <= 2 ? types.filter((type) => ['recall', 'cloze', 'mcq'].includes(type)) : types
  return {
    allowedTypes: types,
    preferredTypes: preferred.length ? preferred : types,
    bloomLevel,
    difficulty,
  }
}
