import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockDayOwnerSingle = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn())
const mockWeekDaysSelect = vi.hoisted(() => vi.fn())
const mockApplyWeek1Progression = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/plan-engine/apply-progression', () => ({
  applyWeek1Progression: mockApplyWeek1Progression,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day') {
        return {
          select: (columns: string) => {
            // The "which week days have a completed session" query embeds
            // workout_session; the ownership-lookup query does not.
            if (columns.includes('workout_session')) {
              return {
                eq: () => ({
                  eq: (...args: unknown[]) => mockWeekDaysSelect(...args),
                }),
              }
            }
            return { eq: () => ({ single: mockDayOwnerSingle }) }
          },
        }
      }

      // table === 'workout_session'
      return {
        update: () => ({
          eq: (...args: unknown[]) => {
            mockUpdateEq(...args)
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/workout-day/day-1/finish', { method: 'POST' })
}

describe('POST /api/workout-day/:workoutDayId/finish', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockDayOwnerSingle.mockReset()
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-1',
        week_number: 1,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })
    mockUpdateEq.mockClear()
    mockWeekDaysSelect.mockReset()
    mockApplyWeek1Progression.mockClear()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the day does not belong to the caller', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-1',
        week_number: 1,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'someone-else' },
      },
      error: null,
    })

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(404)
  })

  it('marks the session complete without triggering progression if other week-1 days remain', async () => {
    mockWeekDaysSelect.mockResolvedValue({
      data: [
        { id: 'day-1', workout_session: [{ completed: true }] },
        { id: 'day-2', workout_session: [{ completed: false }] },
      ],
      error: null,
    })

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(200)
    expect(mockUpdateEq).toHaveBeenCalledWith('workout_day_id', 'day-1')
    expect(mockApplyWeek1Progression).not.toHaveBeenCalled()
  })

  it('triggers progression once every week-1 day has a completed session', async () => {
    mockWeekDaysSelect.mockResolvedValue({
      data: [
        { id: 'day-1', workout_session: [{ completed: true }] },
        { id: 'day-2', workout_session: [{ completed: true }] },
      ],
      error: null,
    })

    await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(mockApplyWeek1Progression).toHaveBeenCalledWith(expect.anything(), 'plan-1')
  })

  it('does not trigger progression for weeks other than 1', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-5',
        week_number: 2,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })

    await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(mockWeekDaysSelect).not.toHaveBeenCalled()
    expect(mockApplyWeek1Progression).not.toHaveBeenCalled()
  })

  it('flags monthCompleted and returns the training plan id once every week-4 day is complete', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-4',
        week_number: 4,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })
    mockWeekDaysSelect.mockResolvedValue({
      data: [
        { id: 'day-4', workout_session: [{ completed: true }] },
        { id: 'day-5', workout_session: [{ completed: true }] },
      ],
      error: null,
    })

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })
    const body = await response.json()

    expect(body).toEqual({ ok: true, monthCompleted: true, trainingPlanId: 'plan-1' })
  })

  it('does not flag monthCompleted if other week-4 days remain incomplete', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-4',
        week_number: 4,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })
    mockWeekDaysSelect.mockResolvedValue({
      data: [
        { id: 'day-4', workout_session: [{ completed: true }] },
        { id: 'day-5', workout_session: [{ completed: false }] },
      ],
      error: null,
    })

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })
    const body = await response.json()

    expect(body).toEqual({ ok: true, monthCompleted: false, trainingPlanId: null })
  })
})
