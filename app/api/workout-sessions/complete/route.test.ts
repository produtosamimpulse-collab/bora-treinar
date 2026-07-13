import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}))

import { POST } from './route'

describe('POST /api/workout-sessions/complete', () => {
  beforeEach(() => {
    mockInsert.mockClear()
  })

  it('creates a completed workout_session row', async () => {
    const request = new Request('http://localhost/api/workout-sessions/complete', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', workoutDayId: 'day-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalledWith([
      { user_id: 'user-1', workout_day_id: 'day-1', completed: true },
    ])
    expect(body).toEqual({ ok: true })
  })
})
