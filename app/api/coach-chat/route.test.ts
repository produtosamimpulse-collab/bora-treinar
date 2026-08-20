import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockChatWithCoach = vi.hoisted(() => vi.fn())
const mockGetSwapOptions = vi.hoisted(() => vi.fn())
const mockApplySwap = vi.hoisted(() => vi.fn())
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn())
const mockDayMaybeSingle = vi.hoisted(() => vi.fn())
const mockSearchExercises = vi.hoisted(() => vi.fn())
const mockRebuildDay = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/openai/coach-chat', () => ({ chatWithCoach: mockChatWithCoach }))
vi.mock('@/lib/plan-engine/exercise-swap', () => ({
  getSwapOptions: mockGetSwapOptions,
  applySwap: mockApplySwap,
}))
vi.mock('@/lib/plan-engine/rebuild-day', () => ({
  searchExercises: mockSearchExercises,
  rebuildDay: mockRebuildDay,
  AVAILABLE_TARGETS: ['hamstrings', 'glutes'],
  TARGET_LABELS_PT: { hamstrings: 'posterior de coxa', glutes: 'glúteos' },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'profile') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockProfileMaybeSingle }) }) }
      }
      // table === 'workout_day'
      return { select: () => ({ eq: () => ({ maybeSingle: mockDayMaybeSingle }) }) }
    },
  }),
}))

import { POST } from './route'

function makeRequest(messages: unknown, workoutDayId = 'day-1') {
  return new Request('http://localhost/api/coach-chat', {
    method: 'POST',
    body: JSON.stringify({ messages, workoutDayId }),
  })
}

describe('POST /api/coach-chat', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockChatWithCoach.mockReset()
    mockChatWithCoach.mockResolvedValue({ content: 'Resposta do treinador', swapped: null })
    mockProfileMaybeSingle.mockReset()
    mockDayMaybeSingle.mockReset()
    mockGetSwapOptions.mockReset()
    mockApplySwap.mockReset()
    mockSearchExercises.mockReset()
    mockRebuildDay.mockReset()
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

    expect(mockChatWithCoach).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Oi' }],
      null,
      expect.objectContaining({ listAlternatives: expect.any(Function), applySwap: expect.any(Function) })
    )
    expect(body).toEqual({ content: 'Resposta do treinador', swapped: null })
  })

  it('passes null context when the day does not belong to the caller', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { goal: 'hipertrofia', level: 'intermediario' },
      error: null,
    })
    mockDayMaybeSingle.mockResolvedValue({
      data: {
        id: 'day-1',
        day_label: 'Upper',
        training_plan: { user_id: 'someone-else' },
        workout_day_exercise: [],
      },
      error: null,
    })

    await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    const [, context] = mockChatWithCoach.mock.calls[0]
    expect(context).toBeNull()
  })

  it('builds the day context with workout_day_exercise ids for an owned day', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { goal: 'hipertrofia', level: 'intermediario' },
      error: null,
    })
    mockDayMaybeSingle.mockResolvedValue({
      data: {
        id: 'day-1',
        day_label: 'Upper',
        training_plan: { user_id: 'user-1' },
        workout_day_exercise: [
          {
            id: 'wde-1',
            target_sets: 4,
            target_reps: 10,
            target_rir: '2-3',
            exercise: { name: 'Bench Press', name_pt: 'Supino Reto' },
          },
        ],
      },
      error: null,
    })

    await POST(makeRequest([{ role: 'user', content: 'Por que esse exercício?' }]))

    const [, context] = mockChatWithCoach.mock.calls[0]
    expect(context).toEqual({
      goal: 'hipertrofia',
      level: 'intermediario',
      dayLabel: 'Peito, Costas e Ombros',
      exercisesPerDay: 6,
      exercises: [{ workoutDayExerciseId: 'wde-1', name: 'Supino Reto', targetSets: 4, targetReps: 10, targetRir: '2-3' }],
    })
  })

  it('wires the tool functions to the shared swap module with the authenticated user id', async () => {
    mockProfileMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockGetSwapOptions.mockResolvedValue([{ id: 'ex-2', name: 'Elevação lateral' }])

    await POST(makeRequest([{ role: 'user', content: 'Oi' }]))

    const [, , tools] = mockChatWithCoach.mock.calls[0]
    await tools.listAlternatives('wde-1')

    expect(mockGetSwapOptions).toHaveBeenCalledWith(expect.anything(), 'wde-1', 'user-1')
  })

  it('pins the rebuild tool to the requested day and the authenticated user', async () => {
    mockProfileMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRebuildDay.mockResolvedValue({ dayLabel: 'Posterior', exercises: [] })

    await POST(makeRequest([{ role: 'user', content: 'quero só posterior' }], 'day-42'))

    const [, , tools] = mockChatWithCoach.mock.calls[0]
    await tools.rebuildDay({ exerciseIds: ['ex-1'], dayLabel: 'Posterior' })

    // o dia e o dono vêm da requisição autenticada, nunca do que a IA mandar
    expect(mockRebuildDay).toHaveBeenCalledWith(expect.anything(), 'day-42', 'user-1', {
      exerciseIds: ['ex-1'],
      dayLabel: 'Posterior',
    })
  })
})
