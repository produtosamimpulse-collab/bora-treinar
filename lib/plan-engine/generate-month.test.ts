import { describe, it, expect, vi } from 'vitest'
import { generateFirstMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

function makeSupabaseMock() {
  const insertedRows: Record<string, unknown[]> = {}

  function makeTable(name: string) {
    return {
      insert: (rows: unknown[]) => {
        insertedRows[name] = insertedRows[name] ?? []
        insertedRows[name].push(...rows)

        const result = { data: null, error: null }

        return {
          // supports `await ...insert(rows)` directly (workout_day_exercise)
          then: (resolve: (value: typeof result) => void) => resolve(result),
          // supports `await ...insert(rows).select().single()` (training_plan, workout_day)
          select: () => ({
            single: async () => {
              const row = { id: `${name}-id-${insertedRows[name].length}`, ...(rows[0] as object) }
              return { data: row, error: null }
            },
          }),
        }
      },
      select: () => ({
        in: () => ({
          limit: async () => ({
            data: [
              { id: 'ex-1', name: 'Exercise 1' },
              { id: 'ex-2', name: 'Exercise 2' },
            ],
            error: null,
          }),
        }),
      }),
    }
  }

  const from = vi.fn((name: string) => makeTable(name))
  return { from, insertedRows } as never
}

const BASE_PROFILE: OnboardingProfile = {
  goal: 'hipertrofia',
  level: 'iniciante',
  days_per_week: 3,
  equipment: 'academia completa',
  restrictions: null,
}

describe('generateFirstMonth', () => {
  it('creates a training_plan and 4 weeks of workout_day with no prescribed load', async () => {
    const supabase = makeSupabaseMock()

    const result = await generateFirstMonth(supabase, 'user-1', BASE_PROFILE)

    expect(result.trainingPlanId).toBe('training_plan-id-1')

    // days_per_week: 3 -> full_body split -> 3 days/week * 4 weeks = 12 workout_day rows
    expect(supabase.insertedRows.workout_day).toHaveLength(12)

    // every workout_day row across all 4 weeks carries a week_number 1-4
    const weekNumbers = (supabase.insertedRows.workout_day as { week_number: number }[]).map(
      (row) => row.week_number
    )
    expect(weekNumbers.filter((w) => w === 1)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 2)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 3)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 4)).toHaveLength(3)

    // 12 workout_day rows * 2 exercises (per the mocked exercise query) = 24 rows
    const dayExercises = supabase.insertedRows.workout_day_exercise as {
      target_load_kg: number | null
    }[]
    expect(dayExercises).toHaveLength(24)
    expect(dayExercises.every((row) => row.target_load_kg === null)).toBe(true)
  })

  it('throws when the training_plan insert fails', async () => {
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
