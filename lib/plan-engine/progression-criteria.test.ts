import { describe, it, expect } from 'vitest'
import { meetsProgressionCriteria } from './progression-criteria'

describe('meetsProgressionCriteria', () => {
  it('returns true when every set hit the target reps and RIR at or below the prescribed max', () => {
    const sets = [
      { repsDone: 10, rirLogged: 2 },
      { repsDone: 12, rirLogged: 3 },
    ]

    expect(meetsProgressionCriteria(sets, 10, '2-3')).toBe(true)
  })

  it('returns false when any set fell short of the target reps', () => {
    const sets = [
      { repsDone: 10, rirLogged: 2 },
      { repsDone: 7, rirLogged: 2 },
    ]

    expect(meetsProgressionCriteria(sets, 10, '2-3')).toBe(false)
  })

  it('returns false when any set was logged above the prescribed max RIR (too easy is fine, too hard is not what we check - too far from failure blocks progression only when reps also miss; here RIR above max means they stopped too early relative to what was prescribed as a ceiling)', () => {
    const sets = [
      { repsDone: 10, rirLogged: 5 },
      { repsDone: 10, rirLogged: 2 },
    ]

    expect(meetsProgressionCriteria(sets, 10, '2-3')).toBe(false)
  })

  it('treats a missing (null) logged RIR as not blocking progression, for sets logged before RIR capture existed', () => {
    const sets = [
      { repsDone: 10, rirLogged: null },
      { repsDone: 12, rirLogged: null },
    ]

    expect(meetsProgressionCriteria(sets, 10, '2-3')).toBe(true)
  })

  it('returns false when there are no logged sets at all', () => {
    expect(meetsProgressionCriteria([], 10, '2-3')).toBe(false)
  })

  it('parses a single-number RIR range like "0" correctly', () => {
    const sets = [{ repsDone: 10, rirLogged: 0 }]
    expect(meetsProgressionCriteria(sets, 10, '0')).toBe(true)

    const setsOverMax = [{ repsDone: 10, rirLogged: 1 }]
    expect(meetsProgressionCriteria(setsOverMax, 10, '0')).toBe(false)
  })
})
