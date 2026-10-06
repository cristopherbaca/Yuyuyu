import { describe, it, expect } from 'vitest'
import { FsrsService, ratingFromVerdict } from '../src/main/services/fsrs'
describe('deterministic FSRS', () => {
  const now = new Date('2026-10-05T10:00:00Z')
  const fsrs = new FsrsService(() => 0.9, () => now)
  it('maps verdicts and caps hinted passes', () => {
    expect(ratingFromVerdict('fail', 'mcq', 100, false)).toBe(1)
    expect(ratingFromVerdict('partial', 'mcq', 100, false)).toBe(2)
    expect(ratingFromVerdict('pass', 'numeric_problem', 50000, false)).toBe(3)
    expect(ratingFromVerdict('pass', 'numeric_problem', 1000, false)).toBe(4)
    expect(ratingFromVerdict('pass', 'numeric_problem', 1000, true)).toBe(3)
  })
  it('serializes dates and recomputes an override from the before state', () => {
    const before = fsrs.create()
    const good = fsrs.schedule(before, 3)
    const again = fsrs.override(fsrs.serialize(before), 1, now)
    expect(again).toEqual(fsrs.schedule(before, 1))
    expect(again.due.getTime()).toBeLessThan(good.due.getTime())
    expect(fsrs.deserialize(fsrs.serialize(good))).toEqual(good)
    expect(fsrs.retrievability(before)).toBe(0)
  })
})
