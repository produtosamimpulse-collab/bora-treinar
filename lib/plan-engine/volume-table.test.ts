import { describe, it, expect } from 'vitest'
import { getVolumeForGoal, getWeeklyVolumeRange, getTargetRir } from './volume-table'

describe('getVolumeForGoal', () => {
  it('returns hypertrophy ranges for hipertrofia', () => {
    const volume = getVolumeForGoal('hipertrofia')
    expect(volume.sets).toBe(4)
    expect(volume.reps).toBe('8-12')
    expect(volume.exercisesPerDay).toBeGreaterThan(0)
  })

  it('returns higher reps and shorter rest emphasis for emagrecimento', () => {
    const volume = getVolumeForGoal('emagrecimento')
    expect(volume.reps).toBe('12-15')
  })

  it('returns a conservative default for saude_geral', () => {
    const volume = getVolumeForGoal('saude_geral')
    expect(volume.sets).toBeLessThanOrEqual(3)
  })
})

describe('getWeeklyVolumeRange', () => {
  it('returns 8-12 for iniciante', () => {
    expect(getWeeklyVolumeRange('iniciante')).toEqual({ min: 8, max: 12 })
  })

  it('returns 12-16 for intermediario', () => {
    expect(getWeeklyVolumeRange('intermediario')).toEqual({ min: 12, max: 16 })
  })

  it('returns 16-20 for avancado', () => {
    expect(getWeeklyVolumeRange('avancado')).toEqual({ min: 16, max: 20 })
  })
})

describe('getTargetRir', () => {
  it('returns 2-3 for iniciante', () => {
    expect(getTargetRir('iniciante')).toBe('2-3')
  })

  it('returns 1-2 for intermediario', () => {
    expect(getTargetRir('intermediario')).toBe('1-2')
  })

  it('returns 0-2 for avancado', () => {
    expect(getTargetRir('avancado')).toBe('0-2')
  })
})
