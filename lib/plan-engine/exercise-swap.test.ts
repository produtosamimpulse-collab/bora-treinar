import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockLoadCatalogPool = vi.hoisted(() => vi.fn())
vi.mock('./catalog-source', () => ({ loadCatalogPool: mockLoadCatalogPool }))

import { getSwapOptions, applySwap } from './exercise-swap'

const POOL = [
  { id: 'ex-squat', name: 'barbell full squat', namePt: 'Agachamento', equipment: 'barbell' },
  { id: 'ex-legpress', name: 'sled 45° leg press', namePt: 'Leg press', equipment: 'sled machine' },
  { id: 'ex-hack', name: 'sled hack squat', namePt: 'Hack', equipment: 'sled machine' },
  { id: 'ex-ext', name: 'lever leg extension', namePt: 'Cadeira extensora', equipment: 'leverage machine' },
  { id: 'ex-lunge', name: 'barbell lunge', namePt: 'Afundo', equipment: 'barbell' },
  { id: 'ex-smith', name: 'smith squat', namePt: 'Agachamento smith', equipment: 'smith machine' },
  { id: 'ex-curl', name: 'barbell curl', namePt: 'Rosca direta', equipment: 'barbell' },
]

const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockUsedSelect = vi.hoisted(() => vi.fn())
const mockChosenMaybeSingle = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

function makeSupabaseMock() {
  const from = vi.fn((table: string) => {
    if (table === 'workout_day_exercise') {
      return {
        select: (columns: string) => {
          if (columns.includes('workout_day:workout_day_id')) {
            return { eq: () => ({ single: mockCurrentSingle }) }
          }
          return { eq: () => mockUsedSelect() }
        },
        update: () => ({ eq: mockUpdateEq }),
      }
    }
    return { select: () => ({ eq: () => ({ maybeSingle: mockChosenMaybeSingle }) }) }
  })

  return { from } as unknown as SupabaseClient
}

function makeCurrentRow(overrides?: { ownerUserId?: string; name?: string }) {
  return {
    id: 'wde-1',
    workout_day_id: 'day-1',
    exercise: { name: overrides?.name ?? 'sled 45° leg press' },
    workout_day: { training_plan: { user_id: overrides?.ownerUserId ?? 'user-1' } },
  }
}

describe('getSwapOptions', () => {
  beforeEach(() => {
    mockCurrentSingle.mockReset()
    mockUsedSelect.mockReset()
    mockLoadCatalogPool.mockReset()
    mockLoadCatalogPool.mockResolvedValue(POOL)
    mockUsedSelect.mockResolvedValue({ data: [], error: null })
  })

  it('returns null when the exercise does not belong to the caller', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow({ ownerUserId: 'outro' }), error: null })

    expect(await getSwapOptions(makeSupabaseMock(), 'wde-1', 'user-1')).toBeNull()
  })

  it('offers other movements of the same group, not variations of the same machine', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })

    const options = await getSwapOptions(makeSupabaseMock(), 'wde-1', 'user-1')

    expect(options?.map((option) => option.name)).toEqual(
      expect.arrayContaining(['Agachamento livre', 'Hack machine', 'Cadeira extensora'])
    )
    expect(options?.every((option) => option.name !== 'Leg press 45°')).toBe(true)
    expect(options?.length).toBeLessThanOrEqual(5)
  })

  it('does not offer a movement already present in the same day', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockUsedSelect.mockResolvedValue({
      data: [{ exercise: { name: 'barbell full squat' } }, { exercise: { name: 'sled 45° leg press' } }],
      error: null,
    })

    const options = await getSwapOptions(makeSupabaseMock(), 'wde-1', 'user-1')

    expect(options?.map((option) => option.name)).not.toContain('Agachamento livre')
  })
})

describe('applySwap', () => {
  beforeEach(() => {
    mockCurrentSingle.mockReset()
    mockChosenMaybeSingle.mockReset()
    mockUpdateEq.mockClear()
    mockLoadCatalogPool.mockResolvedValue(POOL)
  })

  it('rejects a replacement from a different muscle group', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({
      data: { id: 'ex-curl', name: 'barbell curl', name_pt: 'Rosca direta' },
      error: null,
    })

    expect(await applySwap(makeSupabaseMock(), 'wde-1', 'ex-curl', 'user-1')).toEqual({
      error: 'Invalid replacement exercise',
    })
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })

  it('rejects an exercise that is outside the curated catalog', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({
      data: { id: 'ex-weird', name: 'barbell squat (on knees)', name_pt: 'Agachamento ajoelhado' },
      error: null,
    })

    expect(await applySwap(makeSupabaseMock(), 'wde-1', 'ex-weird', 'user-1')).toEqual({
      error: 'Invalid replacement exercise',
    })
  })

  it('swaps and returns the movement name on success', async () => {
    mockCurrentSingle.mockResolvedValue({ data: makeCurrentRow(), error: null })
    mockChosenMaybeSingle.mockResolvedValue({
      data: { id: 'ex-hack', name: 'sled hack squat', name_pt: 'Hack' },
      error: null,
    })

    const result = await applySwap(makeSupabaseMock(), 'wde-1', 'ex-hack', 'user-1')

    expect(result).toEqual({ id: 'ex-hack', name: 'Hack machine', name_pt: 'Hack machine' })
    expect(mockUpdateEq).toHaveBeenCalled()
  })
})
