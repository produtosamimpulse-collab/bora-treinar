import { describe, it, expect } from 'vitest'
import { getCardioPrescription } from './cardio-table'

describe('getCardioPrescription', () => {
  it('prescribes 25 minutes at moderate-to-high intensity every training day for emagrecimento', () => {
    expect(getCardioPrescription('emagrecimento')).toEqual({
      minutes: 25,
      intensity: 'moderada a alta',
      everyDay: true,
    })
  })

  it('prescribes 20 minutes at high (interval) intensity every training day for condicionamento', () => {
    expect(getCardioPrescription('condicionamento')).toEqual({
      minutes: 20,
      intensity: 'alta (intervalado)',
      everyDay: true,
    })
  })

  it('prescribes 20 minutes at moderate intensity on alternating days for saude_geral', () => {
    expect(getCardioPrescription('saude_geral')).toEqual({
      minutes: 20,
      intensity: 'moderada',
      everyDay: false,
    })
  })

  it('prescribes a light 12 minutes on alternating days for hipertrofia, to protect recovery', () => {
    expect(getCardioPrescription('hipertrofia')).toEqual({
      minutes: 12,
      intensity: 'leve',
      everyDay: false,
    })
  })
})
