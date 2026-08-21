import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockLoadCatalogPool = vi.hoisted(() => vi.fn())
vi.mock('./catalog-source', () => ({ loadCatalogPool: mockLoadCatalogPool }))

import { searchExercises, rebuildDay } from './rebuild-day'

// Amostra real do banco, incluindo o lixo que motivou o catálogo curado:
// agachamento ajoelhado e lunge no degrau apareciam num dia de quadríceps.
const POOL = [
  { id: 'ex-squat', name: 'barbell full squat', namePt: 'Agachamento com barra', equipment: 'barbell' },
  { id: 'ex-knees', name: 'barbell squat (on knees)', namePt: 'Agachamento ajoelhado', equipment: 'barbell' },
  { id: 'ex-stepup', name: 'dumbbell step-up lunge', namePt: 'Afundo no degrau', equipment: 'dumbbell' },
  { id: 'ex-legpress', name: 'sled 45° leg press', namePt: 'Leg press 45 graus', equipment: 'sled machine' },
  { id: 'ex-ext', name: 'lever leg extension', namePt: 'Cadeira extensora', equipment: 'leverage machine' },
  { id: 'ex-rdl', name: 'barbell romanian deadlift', namePt: 'Terra romeno', equipment: 'barbell' },
  { id: 'ex-curl', name: 'lever lying leg curl', namePt: 'Mesa flexora', equipment: 'leverage machine' },
  { id: 'ex-calf', name: 'lever standing calf raise', namePt: 'Panturrilha em pé', equipment: 'leverage machine' },
  { id: 'ex-rot', name: 'cable standing shoulder external rotation', namePt: 'Rotação externa', equipment: 'cable' },
  { id: 'ex-bench', name: 'barbell bench press', namePt: 'Supino reto', equipment: 'barbell' },
]

function makeSupabaseMock(options: {
  dayRow?: unknown
  profileRow?: unknown
  chosenRows?: Array<{ id: string; name: string; name_pt: string | null }>
}) {
  const recorded = {
    insertedRows: null as Record<string, unknown>[] | null,
    deletedDayId: null as string | null,
    labelUpdate: null as string | null,
  }

  const from = vi.fn((table: string) => {
    if (table === 'workout_day') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.dayRow ?? null, error: null }) }) }),
        update: (values: { day_label: string }) => ({
          eq: async () => {
            recorded.labelUpdate = values.day_label
            return { error: null }
          },
        }),
      }
    }

    if (table === 'profile') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.profileRow ?? null, error: null }) }) }),
      }
    }

    if (table === 'workout_day_exercise') {
      return {
        delete: () => ({
          eq: async (_column: string, value: string) => {
            recorded.deletedDayId = value
            return { error: null }
          },
        }),
        insert: (rows: Record<string, unknown>[]) => ({
          select: async () => {
            recorded.insertedRows = rows
            return {
              data: rows.map((row, index) => ({
                id: `wde-new-${index}`,
                exercise_id: row.exercise_id,
                order_index: row.order_index,
                target_sets: row.target_sets,
                target_reps: row.target_reps,
                target_rir: row.target_rir,
              })),
              error: null,
            }
          },
        }),
      }
    }

    // table === 'exercise'
    const builder = {
      select: () => builder,
      in: () => builder,
      eq: () => builder,
      then: (resolve: (v: unknown) => unknown) => resolve({ data: options.chosenRows ?? [], error: null }),
    }
    return builder
  })

  return { supabase: { from } as unknown as SupabaseClient, recorded }
}

function makeDayRow(overrides?: { ownerUserId?: string; completed?: boolean; weekType?: string | null }) {
  return {
    id: 'day-1',
    day_label: 'Pernas e Glúteos',
    week_type: overrides?.weekType ?? 'progressao',
    training_plan: { user_id: overrides?.ownerUserId ?? 'user-1' },
    workout_session: [{ completed: overrides?.completed ?? false }],
  }
}

describe('searchExercises', () => {
  beforeEach(() => {
    mockLoadCatalogPool.mockReset()
    mockLoadCatalogPool.mockResolvedValue(POOL)
  })

  it('returns nothing when no criteria was given', async () => {
    expect(await searchExercises({} as SupabaseClient, {})).toEqual([])
    expect(mockLoadCatalogPool).not.toHaveBeenCalled()
  })

  it('never offers the odd variations that made the user complain', async () => {
    const result = await searchExercises({} as SupabaseClient, { groups: ['quadriceps'] })
    const ids = result.map((option) => option.id)

    expect(ids).not.toContain('ex-knees')
    expect(ids).not.toContain('ex-stepup')
  })

  it('offers the classic gym movements for a muscle group, named in portuguese', async () => {
    const result = await searchExercises({} as SupabaseClient, { groups: ['quadriceps'] })

    expect(result.map((option) => option.name)).toEqual(
      expect.arrayContaining(['Agachamento livre', 'Leg press 45°', 'Cadeira extensora'])
    )
    expect(result.find((option) => option.name === 'Leg press 45°')?.id).toBe('ex-legpress')
  })

  it('ignores muscle groups that are not part of the catalog vocabulary', async () => {
    expect(await searchExercises({} as SupabaseClient, { groups: ['hamstrings', 'inventado'] })).toEqual([])
  })

  it('puts compound movements before isolation ones', async () => {
    const result = await searchExercises({} as SupabaseClient, { groups: ['quadriceps'] })

    expect(result[0].mechanic).toBe('composto')
    expect(result[result.length - 1].mechanic).toBe('isolado')
  })

  it('alternates between groups so one group cannot fill the whole list', async () => {
    const result = await searchExercises({} as SupabaseClient, { groups: ['quadriceps', 'posterior'] })

    expect(new Set(result.slice(0, 2).map((option) => option.group)).size).toBe(2)
  })

  it('filters by name, matching both the movement and the real exercise', async () => {
    const result = await searchExercises({} as SupabaseClient, { nameQuery: 'leg press' })

    expect(result.map((option) => option.name)).toEqual(['Leg press 45°'])
  })

  it('selects by beach tennis quality instead of muscle group', async () => {
    const result = await searchExercises({} as SupabaseClient, { beach: ['ombro_estavel'] })

    expect(result.map((option) => option.name)).toContain('Rotação externa de ombro')
    expect(result.every((option) => option.group === 'ombro')).toBe(true)
  })

  it('ignores beach qualities that do not exist', async () => {
    expect(await searchExercises({} as SupabaseClient, { beach: ['saque_perfeito'] })).toEqual([])
  })
})

describe('rebuildDay', () => {
  beforeEach(() => {
    mockLoadCatalogPool.mockReset()
    mockLoadCatalogPool.mockResolvedValue(POOL)
  })

  it('refuses a day that belongs to someone else', async () => {
    const { supabase } = makeSupabaseMock({ dayRow: makeDayRow({ ownerUserId: 'outro' }) })

    expect(await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-squat'] })).toEqual({
      error: 'Treino não encontrado',
    })
  })

  it('refuses a day that was already completed', async () => {
    const { supabase, recorded } = makeSupabaseMock({ dayRow: makeDayRow({ completed: true }) })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-squat'] })

    expect('error' in result && result.error).toContain('já foi concluído')
    expect(recorded.deletedDayId).toBeNull()
  })

  it('refuses an empty list and a list longer than ten exercises', async () => {
    const { supabase } = makeSupabaseMock({ dayRow: makeDayRow() })

    expect(await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: [] })).toEqual({
      error: 'Nenhum exercício informado',
    })
    expect(
      await rebuildDay(supabase, 'day-1', 'user-1', {
        exerciseIds: Array.from({ length: 11 }, (_, i) => `ex-${i}`),
      })
    ).toEqual({ error: 'Um treino pode ter no máximo 10 exercícios' })
  })

  it('refuses an exercise that is not a traditional catalog movement', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenRows: [{ id: 'ex-knees', name: 'barbell squat (on knees)', name_pt: 'Agachamento ajoelhado' }],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-knees'] })

    expect('error' in result && result.error).toContain('não é um exercício tradicional')
    expect(recorded.deletedDayId).toBeNull()
  })

  it('replaces the day, naming exercises by movement and keeping the plan prescription', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenRows: [
        { id: 'ex-ext', name: 'lever leg extension', name_pt: 'Cadeira extensora' },
        { id: 'ex-squat', name: 'barbell full squat', name_pt: 'Agachamento com barra' },
      ],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', {
      exerciseIds: ['ex-ext', 'ex-squat'],
      dayLabel: 'Quadríceps',
    })

    expect(recorded.deletedDayId).toBe('day-1')
    expect(recorded.labelUpdate).toBe('Quadríceps')
    // composto antes de isolado, independente da ordem que a IA mandou
    expect(recorded.insertedRows?.map((row) => row.exercise_id)).toEqual(['ex-squat', 'ex-ext'])
    expect(recorded.insertedRows?.every((row) => row.target_sets === 4)).toBe(true)
    expect(recorded.insertedRows?.every((row) => row.target_reps === 8)).toBe(true)
    expect(recorded.insertedRows?.every((row) => row.target_rir === '1-2')).toBe(true)
    expect(recorded.insertedRows?.every((row) => row.target_load_kg === null)).toBe(true)
    expect('exercises' in result && result.exercises.map((e) => e.name)).toEqual([
      'Agachamento livre',
      'Cadeira extensora',
    ])
  })

  it('halves the sets on a deload week, same as the generated month', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow({ weekType: 'deload' }),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenRows: [{ id: 'ex-squat', name: 'barbell full squat', name_pt: null }],
    })

    await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-squat'] })

    expect(recorded.insertedRows?.[0].target_sets).toBe(2)
  })

  it('keeps the current label when no new one was given', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenRows: [{ id: 'ex-squat', name: 'barbell full squat', name_pt: null }],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-squat'] })

    expect(recorded.labelUpdate).toBeNull()
    expect('dayLabel' in result && result.dayLabel).toBe('Pernas e Glúteos')
  })

  it('deduplicates repeated ids before writing the day', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenRows: [{ id: 'ex-squat', name: 'barbell full squat', name_pt: null }],
    })

    await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-squat', 'ex-squat'] })

    expect(recorded.insertedRows).toHaveLength(1)
  })
})
