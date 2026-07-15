import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockGenerateNextMonth = vi.hoisted(() => vi.fn())
vi.mock('./generate-month', () => ({ generateNextMonth: mockGenerateNextMonth }))

import { submitMonthlyCheckin, type CheckinInput } from './checkin'

const mockPlanMaybeSingle = vi.hoisted(() => vi.fn())
const mockExistingMaybeSingle = vi.hoisted(() => vi.fn())
const mockCheckinInsertSingle = vi.hoisted(() => vi.fn())
const mockCheckinInsertArgs = vi.hoisted(() => vi.fn())
const mockBodyMetricInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockProfileMaybeSingle = vi.hoisted(() => vi.fn())

function makeSupabaseMock(): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === 'training_plan') {
      return { select: () => ({ eq: () => ({ maybeSingle: mockPlanMaybeSingle }) }) }
    }
    if (table === 'monthly_checkin') {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockExistingMaybeSingle }) }) }),
        insert: (rows: unknown[]) => {
          mockCheckinInsertArgs(rows)
          return { select: () => ({ single: mockCheckinInsertSingle }) }
        },
      }
    }
    if (table === 'body_metric') {
      return { insert: (rows: unknown[]) => mockBodyMetricInsert(rows) }
    }
    // table === 'profile'
    return {
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockProfileMaybeSingle }) }) }),
      }),
    }
  })

  return { from } as unknown as SupabaseClient
}

const CHECKIN_INPUT: CheckinInput = {
  weightKg: 72.5,
  painSignal: false,
  motivationLevel: 4,
  difficultyLevel: 3,
  adjustmentDecision: 'Manter progressão normal',
  conversationSummary: 'Aluno relatou boa evolução, sem dores.',
  measurements: { cintura: 82, quadril: 98 },
}

describe('submitMonthlyCheckin', () => {
  beforeEach(() => {
    mockGenerateNextMonth.mockReset()
    mockGenerateNextMonth.mockResolvedValue({ trainingPlanId: 'plan-2' })
    mockPlanMaybeSingle.mockReset()
    mockExistingMaybeSingle.mockReset()
    mockExistingMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockCheckinInsertSingle.mockReset()
    mockCheckinInsertSingle.mockResolvedValue({ data: { id: 'checkin-1' }, error: null })
    mockCheckinInsertArgs.mockClear()
    mockBodyMetricInsert.mockClear()
    mockProfileMaybeSingle.mockReset()
    mockProfileMaybeSingle.mockResolvedValue({
      data: {
        goal: 'hipertrofia',
        level: 'intermediario',
        days_per_week: 4,
        equipment: 'academia completa',
        restrictions: null,
        session_minutes: 60,
        age: 30,
        sex: 'feminino',
        training_history: null,
        excluded_targets: [],
      },
      error: null,
    })
  })

  it('returns an error when the plan does not exist', async () => {
    mockPlanMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await submitMonthlyCheckin(makeSupabaseMock(), 'user-1', 'plan-1', CHECKIN_INPUT)

    expect(result).toEqual({ error: 'Plano não encontrado' })
    expect(mockGenerateNextMonth).not.toHaveBeenCalled()
  })

  it('returns an error when the plan belongs to someone else', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'someone-else', month_number: 1, reference_month: '2026-07-01' },
      error: null,
    })

    const result = await submitMonthlyCheckin(makeSupabaseMock(), 'user-1', 'plan-1', CHECKIN_INPUT)

    expect(result).toEqual({ error: 'Plano não encontrado' })
  })

  it('returns an error when a check-in already exists for that reference month', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', month_number: 1, reference_month: '2026-07-01' },
      error: null,
    })
    mockExistingMaybeSingle.mockResolvedValue({ data: { id: 'checkin-0' }, error: null })

    const result = await submitMonthlyCheckin(makeSupabaseMock(), 'user-1', 'plan-1', CHECKIN_INPUT)

    expect(result).toEqual({ error: 'Você já fez o check-in desse mês' })
    expect(mockGenerateNextMonth).not.toHaveBeenCalled()
  })

  it('stores the check-in and body metric, then generates the next month with the mapped profile', async () => {
    mockPlanMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', month_number: 2, reference_month: '2026-07-01' },
      error: null,
    })

    const result = await submitMonthlyCheckin(makeSupabaseMock(), 'user-1', 'plan-1', CHECKIN_INPUT)

    expect(mockCheckinInsertArgs).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        reference_month: '2026-07-01',
        conversation_summary: CHECKIN_INPUT.conversationSummary,
        pain_signal: false,
        motivation_level: 4,
        difficulty_level: 3,
        adjustment_decision: 'Manter progressão normal',
      }),
    ])

    expect(mockBodyMetricInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        monthly_checkin_id: 'checkin-1',
        weight_kg: 72.5,
        measurements: { cintura: 82, quadril: 98 },
      }),
    ])

    expect(mockGenerateNextMonth).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ goal: 'hipertrofia', days_per_week: 4 }),
      2
    )

    expect(result).toEqual({ trainingPlanId: 'plan-2' })
  })
})
