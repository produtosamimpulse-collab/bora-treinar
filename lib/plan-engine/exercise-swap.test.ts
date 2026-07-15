import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSwapOptions, applySwap } from './exercise-swap'

const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockUsedSelect = vi.hoisted(() => vi.fn())
const mockCandidatesQuery = vi.hoisted(() => vi.fn())
const mockChosenMaybeSingle = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

function makeSupabaseMock() {
  const from = vi.fn((table: string) => {
    if (table === 'workout_day_exercise') {
      return {
        select: (columns: string) => {
          if (columns.includes('exercise:exercise_id')) {
            return { eq: () => ({ single: mockCurrentSingle }) }
          }
          return { eq: () => mockUsedSelect() }
        },
        update: () => ({ eq: mockUpdateEq }),
      }
    }
    // table === 'exercise'
    return {
      select: (columns: string) => {
        if (columns.includes('equipment')) {
          return {
            eq: () => ({
              not: () => ({ not: () => ({ not: async () => mockCandidatesQuery() }) }),
            }),
          }
        }
        return { eq: () => ({ eq: () => ({ maybeSingle: mockChosenMaybeSingle }) }) }
      },
    }
  })

  return { from } as unknown as SupabaseClient
}

function makeCurrentRow(overrides?: { ownerUserId?: string }) {
  return {
    id: 'wde-1',
    workout_day_id: 'day-1',
    exercise: { target: 'pectorals' },
    workout_day: { training_plan: { user_id: overrides?.ownerUserId ?? 'user-1' } },
  }
}

describe('getSwapOptions', () => {
  beforeEach(() => {
    mockCurrentSingle.mockReset()
    mockUsedSelect.mockReset()
    mockCandidatesQuery.mockReset()
  })

  it('returns null when the exercise does not belong to the caller', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow({ ownerUserId: 'someone-else' }), error: null })

    const result = await getSwapOptions(makeSupabaseMock(), 'wde-1', 'user-1')

    expect(result).toBeNull()
  })

  it('prefers distinct equipment and caps at 5 options', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidatesQuery.mockResolvedValue({
      data: [
        { id: 'ex-2', name: 'Barbell Bench Press', name_pt: 'Supino Reto', equipment: 'barbell' },
        { id: 'ex-3', name: 'Close-Grip Barbell Bench Press', name_pt: 'Supino Fechado', equipment: 'barbell' },
        { id: 'ex-4', name: 'Dumbbell Bench Press', name_pt: 'Supino com Halteres', equipment: 'dumbbell' },
        { id: 'ex-5', name: 'Cable Crossover', name_pt: 'Crossover', equipment: 'cable' },
        { id: 'ex-6', name: 'Machine Chest Press', name_pt: 'Supino na Máquina', equipment: 'leverage machine' },
      ],
      error: null,
    })

    const result = await getSwapOptions(makeSupabaseMock(), 'wde-1', 'user-1')

    expect(result?.map((option) => option.id)).toEqual(['ex-2', 'ex-4', 'ex-5', 'ex-6', 'ex-3'])
  })
})

describe('applySwap', () => {
  beforeEach(() => {
    mockCurrentSingle.mockReset()
    mockChosenMaybeSingle.mockReset()
    mockUpdateEq.mockClear()
  })

  it('returns an error object when the exercise does not belong to the caller', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow({ ownerUserId: 'someone-else' }), error: null })

    const result = await applySwap(makeSupabaseMock(), 'wde-1', 'ex-2', 'user-1')

    expect(result).toEqual({ error: 'Exercise not found' })
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('rejects a chosen exercise with a different target', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await applySwap(makeSupabaseMock(), 'wde-1', 'ex-wrong-target', 'user-1')

    expect(result).toEqual({ error: 'Invalid replacement exercise' })
  })

  it('updates the exercise and returns it on success', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({
      data: { id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' },
      error: null,
    })

    const result = await applySwap(makeSupabaseMock(), 'wde-1', 'ex-2', 'user-1')

    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'wde-1')
    expect(result).toEqual({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })
  })
})
