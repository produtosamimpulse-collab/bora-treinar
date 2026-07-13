import { describe, it, expect } from 'vitest'
import { assignWeekdays } from './weekdays'

describe('assignWeekdays', () => {
  it('spreads 1 day to Monday', () => {
    expect(assignWeekdays(1)).toEqual([1])
  })

  it('spreads 3 days to Mon/Wed/Fri', () => {
    expect(assignWeekdays(3)).toEqual([1, 3, 5])
  })

  it('spreads 4 days to Mon/Tue/Thu/Fri', () => {
    expect(assignWeekdays(4)).toEqual([1, 2, 4, 5])
  })

  it('spreads 6 days to Mon through Sat', () => {
    expect(assignWeekdays(6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('spreads 7 days to every day', () => {
    expect(assignWeekdays(7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
