import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockDayOwnerSingle = vi.hoisted(() => vi.fn())
const mockSessionMaybeSingle = vi.hoisted(() => vi.fn())
const mockSessionInsertSingle = vi.hoisted(() => vi.fn())
const mockSetInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day') {
        return { select: () => ({ eq: () => ({ single: mockDayOwnerSingle }) }) }
      }
      if (table === 'workout_session') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: mockSessionMaybeSingle }) }),
          }),
          insert: () => ({ select: () => ({ single: mockSessionInsertSingle }) }),
        }
      }
      // table === 'workout_session_set'
      return { insert: mockSetInsert }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/workout-day/day-1/log-set', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/workout-day/:workoutDayId/log-set', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockDayOwnerSingle.mockReset()
    mockDayOwnerSingle.mockResolvedValue({
      data: { id: 'day-1', training_plan: { user_id: 'user-1' } },
      error: null,
    })
    mockSessionMaybeSingle.mockReset()
    mockSessionInsertSingle.mockReset()
    mockSetInsert.mockClear()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest({}), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the day does not belong to the caller', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: { id: 'day-1', training_plan: { user_id: 'someone-else' } },
      error: null,
    })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 1, repsDone: 10, loadKg: 40 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )

    expect(response.status).toBe(404)
  })

  it('creates a session when none exists yet, then logs the set', async () => {
    mockSessionMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockSessionInsertSingle.mockResolvedValue({ data: { id: 'session-1' }, error: null })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 1, repsDone: 10, loadKg: 40 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )
    const body = await response.json()

    expect(mockSetInsert).toHaveBeenCalledWith([
      { workout_session_id: 'session-1', exercise_id: 'ex-1', set_number: 1, reps_done: 10, load_kg: 40 },
    ])
    expect(body).toEqual({ sessionId: 'session-1' })
  })

  it('reuses an existing incomplete session for the day', async () => {
    mockSessionMaybeSingle.mockResolvedValue({ data: { id: 'session-existing' }, error: null })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 2, repsDone: 8, loadKg: 42.5 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )
    const body = await response.json()

    expect(mockSessionInsertSingle).not.toHaveBeenCalled()
    expect(body).toEqual({ sessionId: 'session-existing' })
  })
})
