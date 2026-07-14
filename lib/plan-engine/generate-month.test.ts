import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateFirstMonth, generateNextMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

const mockSelectExercisesForWeek = vi.hoisted(() => vi.fn())
const mockSelectCardioExercise = vi.hoisted(() => vi.fn())

vi.mock('./weekly-selection', () => ({
  selectExercisesForWeek: mockSelectExercisesForWeek,
}))

vi.mock('./cardio-table', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cardio-table')>()
  return {
    ...actual,
    selectCardioExercise: mockSelectCardioExercise,
  }
})

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
    mockSelectCardioExercise.mockReset()
    mockSelectCardioExercise.mockResolvedValue({ id: 'cardio-1', name: 'Treadmill' })

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

    // hipertrofia -> everyDay: false, minutes: 12, intensity: 'leve' -> alternating
    // days (0-indexed positions 0 and 2) carry the cardio prescription, position 1 doesn't
    const workoutDays = supabase.insertedRows.workout_day as {
      cardio_exercise_id: string | null
      cardio_minutes: number | null
      cardio_intensity: string | null
    }[]
    const cardioByPosition = [0, 1, 2].map(
      (dayIndex) => workoutDays.filter((_, i) => i % 3 === dayIndex)
    )
    expect(
      cardioByPosition[0].every(
        (day) => day.cardio_exercise_id === 'cardio-1' && day.cardio_minutes === 12 && day.cardio_intensity === 'leve'
      )
    ).toBe(true)
    expect(
      cardioByPosition[1].every(
        (day) => day.cardio_exercise_id === null && day.cardio_minutes === null && day.cardio_intensity === null
      )
    ).toBe(true)
    expect(
      cardioByPosition[2].every((day) => day.cardio_exercise_id === 'cardio-1')
    ).toBe(true)

    // week 1 is calibração, weeks 2-4 are progressão
    const weekTypes = (supabase.insertedRows.workout_day as { week_type: string; week_number: number }[]).map(
      (row) => ({ week_number: row.week_number, week_type: row.week_type })
    )
    expect(weekTypes.filter((w) => w.week_number === 1).every((w) => w.week_type === 'calibracao')).toBe(true)
    expect(weekTypes.filter((w) => w.week_number !== 1).every((w) => w.week_type === 'progressao')).toBe(true)
  })

  it('throws when the training_plan insert fails', async () => {
    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([[], [], []])
    mockSelectCardioExercise.mockReset()
    mockSelectCardioExercise.mockResolvedValue(null)

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

describe('generateNextMonth', () => {
  it('increments month_number, marks week 1 as deload with half the sets, and keeps weeks 2-4 at full volume', async () => {
    const supabase = makeSupabaseMock()

    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([
      [{ id: 'ex-1', name: 'Exercise 1', target: 'pectorals', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-2', name: 'Exercise 2', target: 'quads', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-3', name: 'Exercise 3', target: 'lats', secondaryMuscles: [], mechanic: 'composto' }],
    ])
    mockSelectCardioExercise.mockReset()
    mockSelectCardioExercise.mockResolvedValue(null)

    await generateNextMonth(supabase, 'user-1', BASE_PROFILE, 1)

    const plan = (supabase.insertedRows.training_plan as { month_number: number }[])[0]
    expect(plan.month_number).toBe(2)

    const days = supabase.insertedRows.workout_day as { week_number: number; week_type: string }[]
    expect(days.filter((d) => d.week_number === 1).every((d) => d.week_type === 'deload')).toBe(true)
    expect(days.filter((d) => d.week_number !== 1).every((d) => d.week_type === 'progressao')).toBe(true)

    // hipertrofia -> volume.sets is 4 -> deload week gets ceil(4/2) = 2 sets, other weeks keep 4
    const dayExercises = supabase.insertedRows.workout_day_exercise as {
      target_sets: number
    }[]
    // first 3 rows belong to week 1 (deload), the rest to weeks 2-4
    expect(dayExercises.slice(0, 3).every((row) => row.target_sets === 2)).toBe(true)
    expect(dayExercises.slice(3).every((row) => row.target_sets === 4)).toBe(true)
  })
})
