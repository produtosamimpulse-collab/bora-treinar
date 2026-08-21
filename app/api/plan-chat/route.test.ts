import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockChatWithPlanCoach = vi.hoisted(() => vi.fn())
const mockSearchExercises = vi.hoisted(() => vi.fn())
const mockRebuildDay = vi.hoisted(() => vi.fn())
const mockPlanMaybeSingle = vi.hoisted(() => vi.fn())
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn())
const mockDaysQuery = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/openai/plan-chat', () => ({ chatWithPlanCoach: mockChatWithPlanCoach }))
vi.mock('@/lib/plan-engine/rebuild-day', () => ({
  searchExercises: mockSearchExercises,
  rebuildDay: mockRebuildDay,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'training_plan') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockPlanMaybeSingle }) }) }
      }
      if (table === 'profile') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockProfileMaybeSingle }) }) }
      }
      return { select: () => ({ eq: () => ({ order: () => ({ order: mockDaysQuery }) }) }) }
    },
  }),
}))

import { POST } from './route'

function makeRequest(messages: unknown, trainingPlanId = 'plan-1') {
  return new Request('http://localhost/api/plan-chat', {
    method: 'POST',
    body: JSON.stringify({ messages, trainingPlanId }),
  })
}

describe('POST /api/plan-chat', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockChatWithPlanCoach.mockReset()
    mockChatWithPlanCoach.mockResolvedValue({ content: 'ok', rebuiltDayIds: [] })
    mockPlanMaybeSingle.mockReset()
    mockProfileMaybeSingle.mockReset()
    mockDaysQuery.mockReset()
    mockRebuildDay.mockReset()
    mockDaysQuery.mockResolvedValue({ data: [], error: null })
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest([{ role: 'user', content: 'oi' }]))

    expect(response.status).toBe(401)
    expect(mockChatWithPlanCoach).not.toHaveBeenCalled()
  })

  it('gives no plan context when the plan belongs to someone else', async () => {
    mockPlanMaybeSingle.mockResolvedValue({ data: { id: 'plan-1', user_id: 'outro', month_number: 1 }, error: null })

    await POST(makeRequest([{ role: 'user', content: 'oi' }]))

    const [, context] = mockChatWithPlanCoach.mock.calls[0]
    expect(context).toBeNull()
  })

  it('describes the month with the current week detailed and the others summarized', async () => {
    mockPlanMaybeSingle.mockResolvedValue({ data: { id: 'plan-1', user_id: 'user-1', month_number: 2 }, error: null })
    mockProfileMaybeSingle.mockResolvedValue({
      data: { goal: 'hipertrofia', level: 'intermediario', days_per_week: 4 },
      error: null,
    })
    mockDaysQuery.mockResolvedValue({
      data: [
        {
          id: 'day-1',
          day_label: 'Lower',
          day_of_week: 4,
          week_number: 1,
          week_type: 'progressao',
          workout_day_exercise: [{ exercise: { name: 'barbell full squat', name_pt: 'Agachamento' } }],
          workout_session: [{ completed: false }],
        },
        {
          id: 'day-2',
          day_label: 'Upper',
          day_of_week: 2,
          week_number: 2,
          week_type: 'progressao',
          workout_day_exercise: [{ exercise: { name: 'barbell bench press', name_pt: 'Supino' } }],
          workout_session: [],
        },
      ],
      error: null,
    })

    await POST(makeRequest([{ role: 'user', content: 'como está meu mês?' }]))

    const [, context] = mockChatWithPlanCoach.mock.calls[0]
    expect(context.monthNumber).toBe(2)
    expect(context.currentWeek).toBe(1)
    expect(context.days[0]).toMatchObject({
      workoutDayId: 'day-1',
      weekdayName: 'quinta',
      dayLabel: 'Pernas e Glúteos',
      completed: false,
      exercises: ['Agachamento'],
    })
    // semana fora da atual entra só como rótulo, pra não estourar o contexto
    expect(context.days[1].exercises).toEqual([])
  })

  it('pins the rebuild tool to the authenticated user, with the day chosen by the model', async () => {
    mockPlanMaybeSingle.mockResolvedValue({ data: { id: 'plan-1', user_id: 'user-1', month_number: 1 }, error: null })
    mockProfileMaybeSingle.mockResolvedValue({
      data: { goal: 'hipertrofia', level: 'intermediario', days_per_week: 4 },
      error: null,
    })
    mockRebuildDay.mockResolvedValue({ dayLabel: 'Posterior', exercises: [] })

    await POST(makeRequest([{ role: 'user', content: 'muda a quinta' }]))

    const [, , tools] = mockChatWithPlanCoach.mock.calls[0]
    await tools.rebuildDay('day-42', { exerciseIds: ['ex-1'], dayLabel: 'Posterior' })

    expect(mockRebuildDay).toHaveBeenCalledWith(expect.anything(), 'day-42', 'user-1', {
      exerciseIds: ['ex-1'],
      dayLabel: 'Posterior',
    })
  })
})
