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

  it('defaults to month 1 minutes when no month number is given', () => {
    expect(getCardioPrescription('emagrecimento', 1)).toEqual(getCardioPrescription('emagrecimento'))
  })

  it('increases minutes by 5 per month as the person evolves', () => {
    expect(getCardioPrescription('emagrecimento', 2).minutes).toBe(30)
    expect(getCardioPrescription('emagrecimento', 3).minutes).toBe(35)
  })

  it('caps minutes per goal so cardio never overtakes recovery from strength work', () => {
    expect(getCardioPrescription('emagrecimento', 12).minutes).toBe(45)
    expect(getCardioPrescription('hipertrofia', 12).minutes).toBe(20)
  })

  it('keeps intensity and everyDay unchanged across months', () => {
    const month1 = getCardioPrescription('condicionamento', 1)
    const month4 = getCardioPrescription('condicionamento', 4)
    expect(month4.intensity).toBe(month1.intensity)
    expect(month4.everyDay).toBe(month1.everyDay)
  })
})
