import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchExercises, rebuildDay, AVAILABLE_TARGETS, TARGET_LABELS_PT } from './rebuild-day'

type ExerciseRow = {
  id: string
  name: string
  name_pt: string | null
  target: string
  mechanic: string | null
  is_cardio?: boolean
}

type Recorded = {
  targets: string[] | null
  orFilter: string | null
  insertedRows: Record<string, unknown>[] | null
  deletedDayId: string | null
  labelUpdate: string | null
}

function makeSupabaseMock(options: {
  dayRow?: unknown
  profileRow?: unknown
  searchResult?: ExerciseRow[]
  chosenResult?: ExerciseRow[]
}) {
  const recorded: Recorded = {
    targets: null,
    orFilter: null,
    insertedRows: null,
    deletedDayId: null,
    labelUpdate: null,
  }

  const exerciseQuery = () => {
    const builder = {
      eq: () => builder,
      not: () => builder,
      in: (_column: string, values: string[]) => {
        recorded.targets = values
        return builder
      },
      or: (filter: string) => {
        recorded.orFilter = filter
        return builder
      },
      then: (resolve: (value: { data: ExerciseRow[]; error: null }) => unknown) =>
        resolve({ data: options.searchResult ?? options.chosenResult ?? [], error: null }),
    }
    return builder
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
    return { select: exerciseQuery }
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
  it('returns nothing when neither a target nor a name was given', async () => {
    const { supabase } = makeSupabaseMock({ searchResult: [] })

    expect(await searchExercises(supabase, {})).toEqual([])
  })

  it('drops muscle groups that do not exist in the catalog vocabulary', async () => {
    const { supabase, recorded } = makeSupabaseMock({ searchResult: [] })

    await searchExercises(supabase, { targets: ['hamstrings', 'posterior', 'gluteos'] })

    expect(recorded.targets).toEqual(['hamstrings'])
  })

  it('strips PostgREST syntax out of the name search so the filter cannot be broken', async () => {
    const { supabase, recorded } = makeSupabaseMock({ searchResult: [] })

    await searchExercises(supabase, { nameQuery: 'stiff,name.eq.x)' })

    expect(recorded.orFilter).toBe('name.ilike.%stiff name eq x%,name_pt.ilike.%stiff name eq x%')
  })

  it('puts compound movements first and prefers the translated name', async () => {
    const { supabase } = makeSupabaseMock({
      searchResult: [
        { id: 'a', name: 'lever seated leg curl', name_pt: 'Cadeira flexora', target: 'hamstrings', mechanic: 'isolado' },
        { id: 'b', name: 'barbell romanian deadlift', name_pt: null, target: 'hamstrings', mechanic: 'composto' },
      ],
    })

    const result = await searchExercises(supabase, { targets: ['hamstrings'] })

    expect(result.map((exercise) => exercise.id)).toEqual(['b', 'a'])
    expect(result[1].name).toBe('Cadeira flexora')
  })

  it('interleaves muscle groups so one group cannot fill the whole list', async () => {
    const glutes: ExerciseRow[] = Array.from({ length: 6 }, (_, index) => ({
      id: `g${index}`,
      name: `glute ${index}`,
      name_pt: null,
      target: 'glutes',
      mechanic: 'isolado',
    }))
    const { supabase } = makeSupabaseMock({
      searchResult: [
        ...glutes,
        { id: 'h1', name: 'leg curl', name_pt: null, target: 'hamstrings', mechanic: 'isolado' },
      ],
    })

    const result = await searchExercises(supabase, { targets: ['glutes', 'hamstrings'] })

    expect(result.slice(0, 2).map((exercise) => exercise.target)).toEqual(['glutes', 'hamstrings'])
  })
})

describe('rebuildDay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses a day that belongs to someone else', async () => {
    const { supabase } = makeSupabaseMock({ dayRow: makeDayRow({ ownerUserId: 'outro' }) })

    expect(await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1'] })).toEqual({
      error: 'Treino não encontrado',
    })
  })

  it('refuses a day that was already completed', async () => {
    const { supabase, recorded } = makeSupabaseMock({ dayRow: makeDayRow({ completed: true }) })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1'] })

    expect('error' in result && result.error).toContain('já foi concluído')
    expect(recorded.deletedDayId).toBeNull()
  })

  it('refuses an empty list and a list longer than ten exercises', async () => {
    const { supabase } = makeSupabaseMock({ dayRow: makeDayRow() })

    expect(await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: [] })).toEqual({
      error: 'Nenhum exercício informado',
    })

    const tooMany = Array.from({ length: 11 }, (_, index) => `ex-${index}`)
    expect(await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: tooMany })).toEqual({
      error: 'Um treino pode ter no máximo 10 exercícios',
    })
  })

  it('refuses ids that are not in the curated catalog', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenResult: [{ id: 'ex-1', name: 'Stiff', name_pt: null, target: 'hamstrings', mechanic: 'composto' }],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1', 'ex-inventado'] })

    expect('error' in result && result.error).toContain('não existe no catálogo')
    expect(recorded.deletedDayId).toBeNull()
  })

  it('replaces the day, keeping sets, reps and RIR from the plan engine', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenResult: [
        { id: 'ex-1', name: 'seated leg curl', name_pt: 'Cadeira flexora', target: 'hamstrings', mechanic: 'isolado' },
        { id: 'ex-2', name: 'romanian deadlift', name_pt: 'Terra romeno', target: 'hamstrings', mechanic: 'composto' },
      ],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', {
      exerciseIds: ['ex-1', 'ex-2'],
      dayLabel: 'Posterior e Glúteos',
    })

    expect(recorded.deletedDayId).toBe('day-1')
    expect(recorded.labelUpdate).toBe('Posterior e Glúteos')
    // composto primeiro, isolado depois
    expect(recorded.insertedRows?.map((row) => row.exercise_id)).toEqual(['ex-2', 'ex-1'])
    expect(recorded.insertedRows?.every((row) => row.target_sets === 4)).toBe(true)
    expect(recorded.insertedRows?.every((row) => row.target_reps === 8)).toBe(true)
    expect(recorded.insertedRows?.every((row) => row.target_rir === '1-2')).toBe(true)
    // carga vira null: a progressão guardada ali era do exercício antigo
    expect(recorded.insertedRows?.every((row) => row.target_load_kg === null)).toBe(true)

    expect('exercises' in result && result.dayLabel).toBe('Posterior e Glúteos')
    expect('exercises' in result && result.exercises.map((exercise) => exercise.name)).toEqual([
      'Terra romeno',
      'Cadeira flexora',
    ])
  })

  it('halves the sets on a deload week, same as the generated month', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow({ weekType: 'deload' }),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenResult: [{ id: 'ex-1', name: 'Stiff', name_pt: null, target: 'hamstrings', mechanic: 'composto' }],
    })

    await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1'] })

    expect(recorded.insertedRows?.[0].target_sets).toBe(2)
  })

  it('keeps the current label when no new one was given', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenResult: [{ id: 'ex-1', name: 'Stiff', name_pt: null, target: 'hamstrings', mechanic: 'composto' }],
    })

    const result = await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1'] })

    expect(recorded.labelUpdate).toBeNull()
    expect('dayLabel' in result && result.dayLabel).toBe('Pernas e Glúteos')
  })

  it('deduplicates repeated ids before writing the day', async () => {
    const { supabase, recorded } = makeSupabaseMock({
      dayRow: makeDayRow(),
      profileRow: { goal: 'hipertrofia', level: 'intermediario' },
      chosenResult: [{ id: 'ex-1', name: 'Stiff', name_pt: null, target: 'hamstrings', mechanic: 'composto' }],
    })

    await rebuildDay(supabase, 'day-1', 'user-1', { exerciseIds: ['ex-1', 'ex-1'] })

    expect(recorded.insertedRows).toHaveLength(1)
  })
})

describe('vocabulário de grupos musculares', () => {
  it('has a portuguese label for every target the tools accept', () => {
    for (const target of AVAILABLE_TARGETS) {
      expect(TARGET_LABELS_PT[target]).toBeTruthy()
    }
  })
})
