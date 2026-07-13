import { describe, it, expect } from 'vitest'
import { chooseSplit } from './split'

describe('chooseSplit', () => {
  it('uses full body for 2-3 days per week', () => {
    expect(chooseSplit(2).type).toBe('full_body')
    expect(chooseSplit(3).type).toBe('full_body')
    expect(chooseSplit(3).days).toHaveLength(3)
  })

  it('uses upper/lower for 4 days per week', () => {
    const result = chooseSplit(4)
    expect(result.type).toBe('upper_lower')
    expect(result.days.map((d) => d.label)).toEqual(['Upper', 'Lower', 'Upper', 'Lower'])
  })

  it('uses push/pull/legs for 5-6 days per week', () => {
    const result5 = chooseSplit(5)
    expect(result5.type).toBe('push_pull_legs')
    expect(result5.days.map((d) => d.label)).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull'])

    const result6 = chooseSplit(6)
    expect(result6.days.map((d) => d.label)).toEqual([
      'Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs',
    ])
  })

  it('throws for an out-of-range number of days', () => {
    expect(() => chooseSplit(0)).toThrow()
    expect(() => chooseSplit(8)).toThrow()
  })
})
