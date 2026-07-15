import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockApplySwap = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: () => ({}) }))
vi.mock('@/lib/plan-engine/exercise-swap', () => ({ applySwap: mockApplySwap }))

import { POST } from './route'

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
    mockApplySwap.mockReset()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(401)
    expect(mockApplySwap).not.toHaveBeenCalled()
  })

  it('returns 400 when no exerciseId is provided', async () => {
    const response = await POST(makeRequest({}), { params: Promise.resolve({ id: 'wde-1' }) })

    expect(response.status).toBe(400)
    expect(mockApplySwap).not.toHaveBeenCalled()
  })

  it('returns 404 when the shared module reports the exercise was not found', async () => {
    mockApplySwap.mockResolvedValue({ error: 'Exercise not found' })

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 400 when the shared module rejects an invalid replacement', async () => {
    mockApplySwap.mockResolvedValue({ error: 'Invalid replacement exercise' })

    const response = await POST(makeRequest({ exerciseId: 'ex-wrong-target' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(400)
  })

  it('returns the swapped exercise on success', async () => {
    mockApplySwap.mockResolvedValue({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })

    const response = await POST(makeRequest({ exerciseId: 'ex-2' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })
    const body = await response.json()

    expect(mockApplySwap).toHaveBeenCalledWith(expect.anything(), 'wde-1', 'ex-2', 'user-1')
    expect(body).toEqual({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })
  })
})
