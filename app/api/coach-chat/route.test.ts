import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockChatWithCoach = vi.hoisted(() => vi.fn())
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn())
const mockPlanMaybeSingle = vi.hoisted(() => vi.fn())
const mockDaysSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/openai/coach-chat', () => ({ chatWithCoach: mockChatWithCoach }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'profile') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockProfileMaybeSingle }) }) }
      }
      if (table === 'training_plan') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockPlanMaybeSingle }) }) }),
          }),
        }
      }
      // table === 'workout_day'
      return {
        select: () => ({ eq: () => mockDaysSelect() }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(messages: unknown) {
  return new Request('http://localhost/api/coach-chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
}

describe('POST /api/coach-chat', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockChatWithCoach.mockReset()
    mockChatWithCoach.mockResolvedValue('Resposta do treinador')
    mockProfileMaybeSingle.mockReset()
    mockPlanMaybeSingle.mockReset()
    mockDaysSelect.mockReset()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    expect(response.status).toBe(401)
    expect(mockChatWithCoach).not.toHaveBeenCalled()
  })

  it('passes null context when the user has no profile yet', async () => {
    mockProfileMaybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await POST(makeRequest([{ role: 'user', content: 'Oi' }]))
    const body = await response.json()

    expect(mockChatWithCoach).toHaveBeenCalledWith([{ role: 'user', content: 'Oi' }], null)
    expect(body).toEqual({ content: 'Resposta do treinador' })
  })

  it('builds the plan context from the profile and current week when a plan exists', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { goal: 'hipertrofia', level: 'intermediario', days_per_week: 4 },
      error: null,
    })
    mockPlanMaybeSingle.mockResolvedValue({ data: { id: 'plan-1' }, error: null })
    mockDaysSelect.mockResolvedValue({
      data: [
        {
          day_label: 'Upper',
          week_number: 1,
          week_type: 'calibracao',
          cardio_minutes: null,
          cardio_intensity: null,
          cardio_exercise: null,
          workout_day_exercise: [
            {
              target_sets: 4,
              target_reps: 10,
              target_rir: '2-3',
              exercise: { name: 'Bench Press', name_pt: 'Supino Reto' },
            },
          ],
          workout_session: [{ completed: false }],
        },
      ],
      error: null,
    })

    await POST(makeRequest([{ role: 'user', content: 'Por que esse exercício?' }]))

    const [, context] = mockChatWithCoach.mock.calls[0]
    expect(context).toEqual({
      goal: 'hipertrofia',
      level: 'intermediario',
      daysPerWeek: 4,
      currentWeek: 1,
      weekType: 'calibracao',
      days: [
        {
          dayLabel: 'Peito, Costas e Ombros',
          exercises: [{ name: 'Supino Reto', targetSets: 4, targetReps: 10, targetRir: '2-3' }],
          cardio: null,
        },
      ],
    })
  })
})
