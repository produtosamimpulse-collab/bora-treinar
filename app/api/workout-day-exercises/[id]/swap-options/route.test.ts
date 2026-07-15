import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockUsedSelect = vi.hoisted(() => vi.fn())
const mockCandidatesQuery = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day_exercise') {
        return {
          select: (columns: string) => {
            if (columns.includes('exercise:exercise_id')) {
              return { eq: () => ({ single: mockCurrentSingle }) }
            }
            return { eq: () => mockUsedSelect() }
          },
        }
      }
      // table === 'exercise'
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              not: () => ({
                not: async () => mockCandidatesQuery(),
              }),
            }),
          }),
        }),
      }
    },
  }),
}))

import { GET } from './route'

function makeCurrentRow(overrides?: { ownerUserId?: string }) {
  return {
    id: 'wde-1',
    workout_day_id: 'day-1',
    exercise_id: 'ex-1',
    exercise: { target: 'pectorals' },
    workout_day: {
      training_plan: { user_id: overrides?.ownerUserId ?? 'user-1' },
    },
  }
}

function makeRequest() {
  return new Request('http://localhost/api/workout-day-exercises/wde-1/swap-options')
}

describe('GET /api/workout-day-exercises/:id/swap-options', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockCurrentSingle.mockReset()
    mockUsedSelect.mockReset()
    mockCandidatesQuery.mockReset()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the workout_day_exercise belongs to a different user', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow({ ownerUserId: 'someone-else' }), error: null })

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })

    expect(response.status).toBe(404)
  })

  it('caps at 5 options and never repeats equipment while a fresh type is still available', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidatesQuery.mockResolvedValue({
      data: [
        { id: 'ex-2', name: 'Barbell Bench Press', name_pt: 'Supino Reto', equipment: 'barbell' },
        // segunda opção com o MESMO equipamento listada logo em seguida -
        // só deve entrar depois de esgotar os equipamentos diferentes
        { id: 'ex-3', name: 'Close-Grip Barbell Bench Press', name_pt: 'Supino Fechado', equipment: 'barbell' },
        { id: 'ex-4', name: 'Dumbbell Bench Press', name_pt: 'Supino com Halteres', equipment: 'dumbbell' },
        { id: 'ex-5', name: 'Cable Crossover', name_pt: 'Crossover', equipment: 'cable' },
        { id: 'ex-6', name: 'Machine Chest Press', name_pt: 'Supino na Máquina', equipment: 'leverage machine' },
      ],
      error: null,
    })

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })
    const body = (await response.json()) as { id: string; name: string }[]

    expect(body).toHaveLength(5)
    // as 4 opções de equipamento distinto (barbell, dumbbell, cable,
    // leverage machine) vêm primeiro, e ex-3 (barbell repetido) só entra
    // por último, pra completar 5
    expect(body.map((option) => option.id)).toEqual(['ex-2', 'ex-4', 'ex-5', 'ex-6', 'ex-3'])
    expect(body[0]).toEqual({ id: 'ex-2', name: 'Supino Reto' })
  })
})
