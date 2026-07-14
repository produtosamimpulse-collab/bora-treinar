import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFirstMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

const mockSelectExercisesForWeek = vi.hoisted(() => vi.fn())

vi.mock('./weekly-selection', () => ({
  selectExercisesForWeek: mockSelectExercisesForWeek,
}))

type SupabaseMock = SupabaseClient & { insertedRows: Record<string, unknown[]> }

function makeSupabaseMock(): SupabaseMock {
  const insertedRows: Record<string, unknown[]> = {}

  function makeTable(name: string) {
    return {
      insert: (rows: unknown[]) => {
        insertedRows[name] = insertedRows[name] ?? []
        insertedRows[name].push(...rows)

        const result = { data: null, error: null }

        return {
          then: (resolve: (value: typeof result) => void) => resolve(result),
          select: () => ({
            single: async () => {
              const row = { id: `${name}-id-${insertedRows[name].length}`, ...(rows[0] as object) }
              return { data: row, error: null }
            },
          }),
        }
      },
    }
  }

  const from = vi.fn((name: string) => makeTable(name))
  return { from, insertedRows } as unknown as SupabaseMock
}

const BASE_PROFILE: OnboardingProfile = {
  goal: 'hipertrofia',
  level: 'iniciante',
  days_per_week: 3,
  equipment: 'academia completa',
  restrictions: null,
  session_minutes: 60,
  age: 30,
  sex: 'masculino',
  training_history: null,
  excluded_targets: ['forearms'],
}

describe('generateFirstMonth', () => {
  it('creates a training_plan and 4 weeks of workout_day reusing the same weekly exercise selection, with target_rir set', async () => {
    const supabase = makeSupabaseMock()

    // 3 days in the split (full_body for days_per_week: 3), 2 exercises each
    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([
      [{ id: 'ex-1', name: 'Exercise 1', target: 'pectorals', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-2', name: 'Exercise 2', target: 'quads', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-3', name: 'Exercise 3', target: 'lats', secondaryMuscles: [], mechanic: 'composto' }],
    ])

    const result = await generateFirstMonth(supabase, 'user-1', BASE_PROFILE)

    expect(result.trainingPlanId).toBe('training_plan-id-1')

    // selectExercisesForWeek is called exactly once (not once per week), with excluded_targets forwarded
    expect(mockSelectExercisesForWeek).toHaveBeenCalledTimes(1)
    expect(mockSelectExercisesForWeek).toHaveBeenCalledWith(
      supabase,
      expect.any(Array),
      ['forearms'],
      expect.any(Object),
      expect.any(Number)
    )

    // days_per_week: 3 -> full_body split -> 3 days/week * 4 weeks = 12 workout_day rows
    expect(supabase.insertedRows.workout_day).toHaveLength(12)

    const weekNumbers = (supabase.insertedRows.workout_day as { week_number: number }[]).map(
      (row) => row.week_number
    )
    expect(weekNumbers.filter((w) => w === 1)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 2)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 3)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 4)).toHaveLength(3)

    // 12 workout_day rows * 1 exercise (per the mocked weekly selection) = 12 rows,
    // and every week reuses the SAME exercise id per day position (day 1 always ex-1, etc)
    const dayExercises = supabase.insertedRows.workout_day_exercise as {
      exercise_id: string
      target_load_kg: number | null
      target_rir: string
    }[]
    expect(dayExercises).toHaveLength(12)
    expect(dayExercises.every((row) => row.target_load_kg === null)).toBe(true)
    expect(dayExercises.every((row) => row.target_rir === '2-3')).toBe(true)

    const exerciseIdsByPosition = [0, 1, 2].map(
      (dayIndex) => dayExercises.filter((_, i) => i % 3 === dayIndex).map((r) => r.exercise_id)
    )
    expect(exerciseIdsByPosition[0].every((id) => id === 'ex-1')).toBe(true)
    expect(exerciseIdsByPosition[1].every((id) => id === 'ex-2')).toBe(true)
    expect(exerciseIdsByPosition[2].every((id) => id === 'ex-3')).toBe(true)
  })

  it('throws when the training_plan insert fails', async () => {
    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([[], [], []])

    const failingSupabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    } as never

    await expect(generateFirstMonth(failingSupabase, 'user-1', BASE_PROFILE)).rejects.toThrow(
      'insert failed'
    )
  })
})
