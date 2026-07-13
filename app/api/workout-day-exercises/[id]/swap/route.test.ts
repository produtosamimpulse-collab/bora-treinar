import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockUsedSelect = vi.hoisted(() => vi.fn())
const mockCandidateLimit = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

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
          update: () => ({ eq: mockUpdateEq }),
        }
      }
      // table === 'exercise'
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              not: () => ({
                not: () => ({ limit: mockCandidateLimit }),
              }),
            }),
          }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

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

describe('POST /api/workout-day-exercises/:id/swap', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockCurrentSingle.mockReset()
    mockUsedSelect.mockReset()
    mockCandidateLimit.mockReset()
    mockUpdateEq.mockClear()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the workout_day_exercise belongs to a different user', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: makeCurrentRow({ ownerUserId: 'someone-else' }),
      error: null,
    })

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(404)
    expect(mockUsedSelect).not.toHaveBeenCalled()
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('swaps to a different exercise with the same target', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: makeCurrentRow(),
      error: null,
    })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidateLimit.mockResolvedValue({
      data: [{ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' }],
      error: null,
    })

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })
    const body = await response.json()

    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'wde-1')
    expect(body).toEqual({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })
  })

  it('returns an error when no alternative exercise is available', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: makeCurrentRow(),
      error: null,
    })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidateLimit.mockResolvedValue({ data: [], error: null })

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(404)
  })
})
