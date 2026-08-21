import { describe, it, expect } from 'vitest'
import { MUSCLE_GROUPS } from './movement-catalog'
import { chooseSplit } from './split'

describe('chooseSplit', () => {
  it('uses full body for 2-3 days per week', () => {
    expect(chooseSplit(2).type).toBe('full_body')
    expect(chooseSplit(3).type).toBe('full_body')
    expect(chooseSplit(3).days).toHaveLength(3)
    expect(chooseSplit(3).days[0].label).toBe('Corpo Inteiro 1')
  })

  it('uses upper/lower for 4 days per week', () => {
    const result = chooseSplit(4)
    expect(result.type).toBe('upper_lower')
    expect(result.days.map((d) => d.label)).toEqual([
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
    ])
  })

  // Regressão: um ciclo push/pull/legs de 3 dias não divide igualmente em
  // frequências como 5 dias (2 push + 2 pull + 1 legs), sobrecarregando a
  // parte superior do corpo. Alternar superior/inferior mantém o equilíbrio
  // em qualquer frequência de 4 ou mais dias.
  it('alternates upper/lower for 5, 6 and 7 days per week instead of clustering upper-body days', () => {
    const result5 = chooseSplit(5)
    expect(result5.type).toBe('upper_lower')
    expect(result5.days.map((d) => d.label)).toEqual([
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
    ])

    const result6 = chooseSplit(6)
    expect(result6.days.map((d) => d.label)).toEqual([
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
    ])

    const result7 = chooseSplit(7)
    expect(result7.days.map((d) => d.label)).toEqual([
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
      'Pernas e Glúteos',
      'Peito, Costas e Ombros',
    ])
  })

  it('never lets upper-body days outnumber lower-body days by more than one, for any frequency', () => {
    for (const daysPerWeek of [4, 5, 6, 7]) {
      const { days } = chooseSplit(daysPerWeek)
      const upperCount = days.filter((d) => d.label === 'Peito, Costas e Ombros').length
      const lowerCount = days.filter((d) => d.label === 'Pernas e Glúteos').length
      expect(Math.abs(upperCount - lowerCount)).toBeLessThanOrEqual(1)
    }
  })

  it('throws for an out-of-range number of days', () => {
    expect(() => chooseSplit(0)).toThrow()
    expect(() => chooseSplit(8)).toThrow()
  })

  // Regressão: o split agora fala o vocabulário do catálogo de movimentos
  // (peito, quadriceps, posterior...), não o `target` da ExerciseDB, que
  // colocava agachamento, hack e leg press todos como "glutes".
  it('uses only muscle groups that exist in the movement catalog', () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) {
      for (const day of chooseSplit(days).days) {
        for (const group of day.groups) {
          expect(MUSCLE_GROUPS).toContain(group)
        }
      }
    }
  })
})
