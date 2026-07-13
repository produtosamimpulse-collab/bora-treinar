import { describe, it, expect, vi } from 'vitest'
import { generateFirstMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

function makeSupabaseMock() {
  const insertedRows: Record<string, unknown[]> = {}

  function makeTable(name: string) {
    return {
      insert: (rows: unknown[]) => ({
        select: () => ({
          single: async () => {
            const row = { id: `${name}-id`, ...(rows[0] as object) }
            insertedRows[name] = insertedRows[name] ?? []
            insertedRows[name].push(row)
            return { data: row, error: null }
          },
        }),
      }),
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

describe('generateFirstMonth', () => {
  it('creates a training_plan and 4 weeks of workout_day with no prescribed load', async () => {
    const supabase = makeSupabaseMock()
    const profile: OnboardingProfile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }

    const result = await generateFirstMonth(supabase, 'user-1', profile)

    expect(result.trainingPlanId).toBe('training_plan-id')
  })
})
