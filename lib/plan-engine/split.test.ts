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

  // Regressão: os targets precisam bater com o vocabulário real da coluna
  // `exercise.target` (ex: "pectorals", "abs"), não com `muscle_group`
  // (ex: "chest"). Confirmado consultando os 1394 exercícios sincronizados.
  const VALID_EXERCISEDB_TARGETS = new Set([
    'abductors', 'abs', 'adductors', 'biceps', 'calves',
    'cardiovascular system', 'delts', 'forearms', 'glutes', 'hamstrings',
    'lats', 'levator scapulae', 'pectorals', 'quads',
    'serratus anterior', 'spine', 'traps', 'triceps', 'upper back',
  ])

  it('uses only real exercise.target vocabulary in every split', () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6, 7]) {
      const { days } = chooseSplit(daysPerWeek)
      for (const day of days) {
        for (const target of day.targets) {
          expect(VALID_EXERCISEDB_TARGETS.has(target)).toBe(true)
        }
      }
    }
  })

  it('keeps triceps and biceps on separate days for push/pull splits', () => {
    const { days } = chooseSplit(6)
    const push = days.find((d) => d.label === 'Push')!
    const pull = days.find((d) => d.label === 'Pull')!

    expect(push.targets).toContain('triceps')
    expect(push.targets).not.toContain('biceps')
    expect(pull.targets).toContain('biceps')
    expect(pull.targets).not.toContain('triceps')
  })
})
