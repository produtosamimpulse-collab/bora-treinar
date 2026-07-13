import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockChatWithTool,
  mockGenerateFirstMonth,
  mockInsert,
  mockSingle,
  mockGetAuthenticatedUserId,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockChatWithTool: vi.fn(),
  mockGenerateFirstMonth: vi.fn(),
  mockInsert: vi.fn(),
  mockSingle: vi.fn(),
  mockGetAuthenticatedUserId: vi.fn(),
  mockMaybeSingle: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({ chatWithTool: mockChatWithTool }))
vi.mock('@/lib/plan-engine/generate-month', () => ({ generateFirstMonth: mockGenerateFirstMonth }))
vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'training_plan') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: mockMaybeSingle }),
            }),
          }),
        }
      }

      return {
        insert: (...args: unknown[]) => {
          mockInsert(...args)
          return { select: () => ({ single: mockSingle }) }
        },
      }
    },
  }),
}))

import { POST } from './route'

describe('POST /api/onboarding/chat', () => {
  beforeEach(() => {
    mockChatWithTool.mockReset()
    mockGenerateFirstMonth.mockReset()
    mockInsert.mockReset()
    mockSingle.mockReset()
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockMaybeSingle.mockReset()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Oi' }] }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(mockChatWithTool).not.toHaveBeenCalled()
  })

  it('returns the assistant message when onboarding is not complete', async () => {
    mockChatWithTool.mockResolvedValue({ type: 'message', content: 'Qual seu objetivo?' })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Oi' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(body).toEqual({ type: 'message', content: 'Qual seu objetivo?' })
  })

  it('saves the profile and generates the first month when onboarding completes, using the session user id', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }
    mockChatWithTool.mockResolvedValue({ type: 'tool_call', profile })
    mockSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null })
    mockGenerateFirstMonth.mockResolvedValue({ trainingPlanId: 'plan-1' })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Pronto' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ user_id: 'user-1' })])
    expect(mockGenerateFirstMonth).toHaveBeenCalledWith(expect.anything(), 'user-1', profile)
    expect(body).toEqual({ type: 'completed', trainingPlanId: 'plan-1' })
  })

  it('redirects to the existing plan when one already exists for this month', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }
    mockChatWithTool.mockResolvedValue({ type: 'tool_call', profile })
    mockSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null })
    mockGenerateFirstMonth.mockRejectedValue(new Error('duplicate key value violates unique constraint'))
    mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-plan-1' }, error: null })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Pronto' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ type: 'completed', trainingPlanId: 'existing-plan-1' })
  })

  it('returns a friendly message when generation fails and no existing plan is found', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }
    mockChatWithTool.mockResolvedValue({ type: 'tool_call', profile })
    mockSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null })
    mockGenerateFirstMonth.mockRejectedValue(new Error('some other failure'))
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Pronto' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.type).toBe('message')
  })
})
