import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockChatWithTool, mockGenerateFirstMonth, mockInsert, mockSingle } = vi.hoisted(() => ({
  mockChatWithTool: vi.fn(),
  mockGenerateFirstMonth: vi.fn(),
  mockInsert: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({ chatWithTool: mockChatWithTool }))
vi.mock('@/lib/plan-engine/generate-month', () => ({ generateFirstMonth: mockGenerateFirstMonth }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args)
        return { select: () => ({ single: mockSingle }) }
      },
    }),
  }),
}))

import { POST } from './route'

describe('POST /api/onboarding/chat', () => {
  beforeEach(() => {
    mockChatWithTool.mockReset()
    mockGenerateFirstMonth.mockReset()
    mockInsert.mockReset()
    mockSingle.mockReset()
  })

  it('returns the assistant message when onboarding is not complete', async () => {
    mockChatWithTool.mockResolvedValue({ type: 'message', content: 'Qual seu objetivo?' })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', messages: [{ role: 'user', content: 'Oi' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(body).toEqual({ type: 'message', content: 'Qual seu objetivo?' })
  })

  it('saves the profile and generates the first month when onboarding completes', async () => {
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
      body: JSON.stringify({ userId: 'user-1', messages: [{ role: 'user', content: 'Pronto' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalled()
    expect(mockGenerateFirstMonth).toHaveBeenCalledWith(expect.anything(), 'user-1', profile)
    expect(body).toEqual({ type: 'completed', trainingPlanId: 'plan-1' })
  })
})
