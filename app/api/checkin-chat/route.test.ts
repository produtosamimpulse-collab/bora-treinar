import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockChatWithCheckin = vi.hoisted(() => vi.fn())
const mockSubmitMonthlyCheckin = vi.hoisted(() => vi.fn())
const mockPlanMaybeSingle = vi.hoisted(() => vi.fn())
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/openai/checkin-chat', () => ({ chatWithCheckin: mockChatWithCheckin }))
vi.mock('@/lib/plan-engine/checkin', () => ({ submitMonthlyCheckin: mockSubmitMonthlyCheckin }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'training_plan') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockPlanMaybeSingle }) }) }
      }
      // table === 'profile'
      return {
        select: () => ({
          eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockProfileMaybeSingle }) }) }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(messages: unknown, trainingPlanId = 'plan-1') {
  return new Request('http://localhost/api/checkin-chat', {
    method: 'POST',
    body: JSON.stringify({ messages, trainingPlanId }),
  })
}

describe('POST /api/checkin-chat', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockChatWithCheckin.mockReset()
    mockChatWithCheckin.mockResolvedValue({ content: 'Resposta', completed: false, trainingPlanId: null })
    mockSubmitMonthlyCheckin.mockReset()
    mockPlanMaybeSingle.mockReset()
    mockProfileMaybeSingle.mockReset()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    expect(response.status).toBe(401)
    expect(mockChatWithCheckin).not.toHaveBeenCalled()
  })

  it('passes null context when the plan does not belong to the caller', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'someone-else', month_number: 1, goal: 'hipertrofia' },
      error: null,
    })

    await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    const [, context] = mockChatWithCheckin.mock.calls[0]
    expect(context).toBeNull()
  })

  it('builds the check-in context from the owned plan and profile level', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', month_number: 2, goal: 'hipertrofia' },
      error: null,
    })
    mockProfileMaybeSingle.mockResolvedValue({ data: { level: 'intermediario' }, error: null })

    await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    const [, context] = mockChatWithCheckin.mock.calls[0]
    expect(context).toEqual({ goal: 'hipertrofia', level: 'intermediario', monthNumber: 2 })
  })

  it('wires finalizeCheckin to submitMonthlyCheckin with the authenticated user id and plan id', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', month_number: 2, goal: 'hipertrofia' },
      error: null,
    })
    mockProfileMaybeSingle.mockResolvedValue({ data: { level: 'intermediario' }, error: null })
    mockSubmitMonthlyCheckin.mockResolvedValue({ trainingPlanId: 'plan-2' })

    await POST(makeRequest([{ role: 'user', content: 'Oi' }], 'plan-1'))

    const [, , tools] = mockChatWithCheckin.mock.calls[0]
    await tools.finalizeCheckin({
      weightKg: 70,
      painSignal: false,
      motivationLevel: 4,
      difficultyLevel: 3,
      adjustmentDecision: 'Manter',
      conversationSummary: 'Resumo',
      measurements: null,
    })

    expect(mockSubmitMonthlyCheckin).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'plan-1',
      expect.objectContaining({ weightKg: 70, adjustmentDecision: 'Manter' })
    )
  })
})
