import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockGetSwapOptions = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: () => ({}) }))
vi.mock('@/lib/plan-engine/exercise-swap', () => ({ getSwapOptions: mockGetSwapOptions }))

import { GET } from './route'

function makeRequest() {
  return new Request('http://localhost/api/workout-day-exercises/wde-1/swap-options')
}

describe('GET /api/workout-day-exercises/:id/swap-options', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockGetSwapOptions.mockReset()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })

    expect(response.status).toBe(401)
    expect(mockGetSwapOptions).not.toHaveBeenCalled()
  })

  it('returns 404 when the shared lookup finds no owned exercise', async () => {
    mockGetSwapOptions.mockResolvedValue(null)

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })

    expect(response.status).toBe(404)
  })

  it('returns the options from the shared module', async () => {
    mockGetSwapOptions.mockResolvedValue([
      { id: 'ex-2', name: 'Supino Reto' },
      { id: 'ex-3', name: 'Supino com Halteres' },
    ])

    const response = await GET(makeRequest(), { params: Promise.resolve({ id: 'wde-1' }) })
    const body = await response.json()

    expect(mockGetSwapOptions).toHaveBeenCalledWith(expect.anything(), 'wde-1', 'user-1')
    expect(body).toEqual([
      { id: 'ex-2', name: 'Supino Reto' },
      { id: 'ex-3', name: 'Supino com Halteres' },
    ])
  })
})
