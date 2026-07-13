import { describe, it, expect } from 'vitest'
import { determineCurrentWeek } from './week-progress'

describe('determineCurrentWeek', () => {
  it('returns week 1 when nothing is completed', () => {
    expect(determineCurrentWeek({ 1: false, 2: false, 3: false, 4: false })).toBe(1)
  })

  it('returns week 2 when week 1 is complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: false, 3: false, 4: false })).toBe(2)
  })

  it('returns week 4 when weeks 1-3 are complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: true, 3: true, 4: false })).toBe(4)
  })

  it('returns week 4 when everything is complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: true, 3: true, 4: true })).toBe(4)
  })

  it('treats a missing key as not completed', () => {
    expect(determineCurrentWeek({ 1: true })).toBe(2)
  })
})
