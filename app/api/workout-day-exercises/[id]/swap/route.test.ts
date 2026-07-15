import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockChosenMaybeSingle = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day_exercise') {
        return {
          select: () => ({ eq: () => ({ single: mockCurrentSingle }) }),
          update: () => ({ eq: mockUpdateEq }),
        }
      }
      // table === 'exercise'
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: mockChosenMaybeSingle }) }),
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

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/workout-day-exercises/wde-1/swap', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/workout-day-exercises/:id/swap', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockCurrentSingle.mockReset()
    mockChosenMaybeSingle.mockReset()
    mockUpdateEq.mockClear()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the workout_day_exercise belongs to a different user', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: makeCurrentRow({ ownerUserId: 'someone-else' }),
      error: null,
    })

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(404)
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('swaps to the chosen exercise when it shares the same target', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({
      data: { id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' },
      error: null,
    })

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })
    const body = await response.json()

    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'wde-1')
    expect(body).toEqual({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })
  })

  it('rejects a chosen exercise that does not exist or has a different target', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await POST(makeRequest({ exerciseId: 'ex-wrong-target' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(400)
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('returns 400 when no exerciseId is provided', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })

    const response = await POST(makeRequest({}), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(400)
  })
})
