import { describe, it, expect } from 'vitest'
import { calculateProgressiveLoad } from './progression'

describe('calculateProgressiveLoad', () => {
  it('applies a 5% increase for week 2', () => {
    expect(calculateProgressiveLoad(100, 2)).toBeCloseTo(105)
  })

  it('applies a cumulative 5% increase for week 3', () => {
    expect(calculateProgressiveLoad(100, 3)).toBeCloseTo(110.25)
  })

  it('applies a smaller cumulative increase for week 4', () => {
    expect(calculateProgressiveLoad(100, 4)).toBeCloseTo(113.00625)
  })

  it('never exceeds a 5% single-step increase, even with a tampered rate', () => {
    // guardrail: mesmo que alguém tente passar uma semana inválida, a função
    // nunca deve compor mais de 5% por "passo" de semana.
    const week2 = calculateProgressiveLoad(100, 2)
    expect(week2 / 100).toBeLessThanOrEqual(1.05)
  })
})
