import { describe, it, expect } from 'vitest'
import { classifyCardioName } from './cardio-catalog'

describe('classifyCardioName', () => {
  it('classifies a treadmill exercise', () => {
    expect(classifyCardioName('Walking on Incline Treadmill')?.namePt).toBe('Esteira')
  })

  it('classifies a stationary bike exercise', () => {
    expect(classifyCardioName('Stationary Bike Run V. 3')?.namePt).toBe('Bicicleta ergométrica')
  })

  it('classifies an elliptical exercise', () => {
    expect(classifyCardioName('Walk Elliptical Cross Trainer')?.namePt).toBe('Elíptico')
  })

  it('classifies a stepmill exercise', () => {
    expect(classifyCardioName('Walking on Stepmill')?.namePt).toBe('Escada (stairmaster)')
  })

  it('classifies a rowing machine exercise', () => {
    expect(classifyCardioName('Rowing Machine')?.namePt).toBe('Remo ergômetro')
  })

  it('returns null for a bodyweight calisthenics move that is not a real cardio machine', () => {
    expect(classifyCardioName('Burpee')).toBeNull()
    expect(classifyCardioName('Jump Rope')).toBeNull()
    expect(classifyCardioName('Mountain Climber')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(classifyCardioName('TREADMILL RUN')?.namePt).toBe('Esteira')
  })
})
