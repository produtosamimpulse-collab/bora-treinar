import { describe, it, expect } from 'vitest'
import { planWeekExercises, candidatesForDay, normalizeExcludedGroups, type CandidateExercise } from './weekly-selection'
import type { SplitDay } from './split'

function candidate(
  id: string,
  group: CandidateExercise['group'],
  movementId: string,
  mechanic: CandidateExercise['mechanic'] = 'composto'
): CandidateExercise {
  return { id, name: movementId, group, movementId, mechanic }
}

const POOL = [
  { id: 'ex-squat', name: 'barbell full squat', namePt: null, equipment: 'barbell' },
  { id: 'ex-knees', name: 'barbell squat (on knees)', namePt: null, equipment: 'barbell' },
  { id: 'ex-legpress', name: 'sled 45° leg press', namePt: null, equipment: 'sled machine' },
  { id: 'ex-ext', name: 'lever leg extension', namePt: null, equipment: 'leverage machine' },
  { id: 'ex-rdl', name: 'barbell romanian deadlift', namePt: null, equipment: 'barbell' },
  { id: 'ex-curl', name: 'lever lying leg curl', namePt: null, equipment: 'leverage machine' },
  { id: 'ex-bench', name: 'barbell bench press', namePt: null, equipment: 'barbell' },
]

describe('candidatesForDay', () => {
  const legDay: SplitDay = { label: 'Pernas', groups: ['quadriceps', 'posterior'] }

  it('builds the day from catalog movements and skips the odd variations', () => {
    const candidates = candidatesForDay(legDay, POOL, [])

    expect(candidates.map((c) => c.id)).not.toContain('ex-knees')
    expect(candidates.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Agachamento livre', 'Leg press 45°', 'Stiff (terra romeno)'])
    )
  })

  it('never mixes in a group outside the day', () => {
    const candidates = candidatesForDay(legDay, POOL, [])

    expect(candidates.every((c) => ['quadriceps', 'posterior'].includes(c.group))).toBe(true)
  })

  it('drops a group the athlete asked to avoid', () => {
    const candidates = candidatesForDay(legDay, POOL, ['posterior'])

    expect(candidates.every((c) => c.group === 'quadriceps')).toBe(true)
  })

  it('puts compound movements first', () => {
    const candidates = candidatesForDay(legDay, POOL, [])

    expect(candidates[0].mechanic).toBe('composto')
  })
})

describe('normalizeExcludedGroups', () => {
  it('understands the old ExerciseDB vocabulary saved in existing profiles', () => {
    expect(normalizeExcludedGroups(['hamstrings', 'quads'])).toEqual(['posterior', 'quadriceps'])
  })

  it('understands what the athlete actually types, accents included', () => {
    expect(normalizeExcludedGroups(['Ombros', 'panturrilha', 'glúteos'])).toEqual([
      'ombro',
      'panturrilha',
      'gluteo',
    ])
  })

  it('ignores anything it cannot map instead of guessing', () => {
    expect(normalizeExcludedGroups(['tudo que dói'])).toEqual([])
  })
})

describe('planWeekExercises', () => {
  it('does not repeat the same movement across days when there are alternatives', () => {
    const day = [
      candidate('a', 'quadriceps', 'agachamento-livre'),
      candidate('b', 'quadriceps', 'leg-press'),
      candidate('c', 'quadriceps', 'hack-machine'),
      candidate('d', 'quadriceps', 'afundo'),
    ]

    const [first, second] = planWeekExercises([day, day], { min: 8, max: 12 }, 2)

    const firstIds = first.map((exercise) => exercise.movementId)
    expect(second.every((exercise) => !firstIds.includes(exercise.movementId))).toBe(true)
  })

  it('orders each day compound-first', () => {
    const day = [
      candidate('a', 'quadriceps', 'cadeira-extensora', 'isolado'),
      candidate('b', 'quadriceps', 'agachamento-livre', 'composto'),
    ]

    const [chosen] = planWeekExercises([day], { min: 8, max: 12 }, 2)

    expect(chosen.map((exercise) => exercise.mechanic)).toEqual(['composto', 'isolado'])
  })

  it('stops adding to a group once the weekly cap is reached, preferring another group', () => {
    const day = [
      candidate('a', 'quadriceps', 'agachamento-livre'),
      candidate('b', 'quadriceps', 'leg-press'),
      candidate('c', 'posterior', 'stiff'),
    ]

    const [chosen] = planWeekExercises([day], { min: 1, max: 1 }, 2)

    expect(chosen.map((exercise) => exercise.group).sort()).toEqual(['posterior', 'quadriceps'])
  })

  it('fills the day even when the cap would leave it short', () => {
    const day = [
      candidate('a', 'quadriceps', 'agachamento-livre'),
      candidate('b', 'quadriceps', 'leg-press'),
      candidate('c', 'quadriceps', 'hack-machine'),
    ]

    const [chosen] = planWeekExercises([day], { min: 1, max: 1 }, 3)

    expect(chosen).toHaveLength(3)
  })

  it('spreads the day across its groups instead of letting one monopolize the slots', () => {
    const day = [
      candidate('a', 'quadriceps', 'agachamento-livre'),
      candidate('b', 'quadriceps', 'leg-press'),
      candidate('c', 'quadriceps', 'hack-machine'),
      candidate('d', 'posterior', 'stiff'),
      candidate('e', 'posterior', 'mesa-flexora'),
    ]

    const [chosen] = planWeekExercises([day], { min: 8, max: 12 }, 2)

    expect(new Set(chosen.map((exercise) => exercise.group)).size).toBe(2)
  })
})
