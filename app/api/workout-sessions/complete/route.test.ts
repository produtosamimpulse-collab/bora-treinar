import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}))
vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))

import { POST } from './route'

describe('POST /api/workout-sessions/complete', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const request = new Request('http://localhost/api/workout-sessions/complete', {
      method: 'POST',
      body: JSON.stringify({ workoutDayId: 'day-1' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('creates a completed workout_session row using the session user id', async () => {
    const request = new Request('http://localhost/api/workout-sessions/complete', {
      method: 'POST',
      body: JSON.stringify({ workoutDayId: 'day-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalledWith([
      { user_id: 'user-1', workout_day_id: 'day-1', completed: true },
    ])
    expect(body).toEqual({ ok: true })
  })
})
