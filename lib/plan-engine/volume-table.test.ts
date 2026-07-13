import { describe, it, expect } from 'vitest'
import { getVolumeForGoal } from './volume-table'

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
