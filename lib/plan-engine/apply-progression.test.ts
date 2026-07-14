import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyWeek1Progression } from './apply-progression'

type Row = Record<string, unknown>

/**
 * A generic, row-filtering Supabase mock: each table is backed by a plain
 * array of rows, `.eq()` narrows that array, `.maybeSingle()` returns the
 * first surviving row (or null), and awaiting the chain directly (without
 * `.maybeSingle()`) resolves to the full filtered array - mirroring how the
 * real supabase-js query builder is itself a thenable.
 *
 * Decoy rows are deliberately seeded ahead of the "correct" rows in each
 * table so that an implementation missing a required `.eq()` filter (e.g.
 * forgetting to filter the future day by `day_of_week`, or the future
 * exercise by `order_index`) would pick up the wrong row and fail the
 * assertions - this keeps the test from being a tautology.
 *
 * Regression: every day here shares the SAME `day_label` ("Peito, Ombros e
 * Tríceps"), mirroring a real 4+ day/week split where multiple days per week
 * carry identical labels (e.g. upper_lower repeats "Pernas e Glúteos" twice,
 * push_pull_legs repeats each label at 6+ days). day_label is NOT a safe
 * disambiguator between days in the same week - only `day_of_week` is
 * guaranteed unique per day (see lib/plan-engine/weekdays.ts). The decoy
 * days below share the label but have a different `day_of_week`, so this
 * test would fail if the implementation matched on day_label instead.
 */
function makeSupabaseMock(
  loggedSets: { load_kg: number; reps_done: number; rir_logged: number | null }[] = [
    { load_kg: 40, reps_done: 10, rir_logged: 2 },
    { load_kg: 45, reps_done: 10, rir_logged: 2 },
  ]
) {
  const tables: Record<string, Row[]> = {
    workout_day: [
      { id: 'day-w1', training_plan_id: 'plan-1', week_number: 1, day_label: 'Peito, Ombros e Tríceps', day_of_week: 1 },

      // week 2: decoy day with the SAME label but the wrong day_of_week, listed first
      { id: 'day-w2-decoy', training_plan_id: 'plan-1', week_number: 2, day_label: 'Peito, Ombros e Tríceps', day_of_week: 4 },
      { id: 'day-w2', training_plan_id: 'plan-1', week_number: 2, day_label: 'Peito, Ombros e Tríceps', day_of_week: 1 },

      { id: 'day-w3-decoy', training_plan_id: 'plan-1', week_number: 3, day_label: 'Peito, Ombros e Tríceps', day_of_week: 4 },
      { id: 'day-w3', training_plan_id: 'plan-1', week_number: 3, day_label: 'Peito, Ombros e Tríceps', day_of_week: 1 },

      { id: 'day-w4-decoy', training_plan_id: 'plan-1', week_number: 4, day_label: 'Peito, Ombros e Tríceps', day_of_week: 4 },
      { id: 'day-w4', training_plan_id: 'plan-1', week_number: 4, day_label: 'Peito, Ombros e Tríceps', day_of_week: 1 },
    ],
    workout_day_exercise: [
      { id: 'wde-w1', workout_day_id: 'day-w1', exercise_id: 'ex-1', order_index: 0, target_reps: 8, target_rir: '2-3' },

      { id: 'wde-w2-decoy-day', workout_day_id: 'day-w2-decoy', exercise_id: 'ex-other', order_index: 0 },
      // wrong order_index on the CORRECT day, listed first
      { id: 'wde-w2-wrong-order', workout_day_id: 'day-w2', exercise_id: 'ex-1', order_index: 1 },
      { id: 'wde-w2', workout_day_id: 'day-w2', exercise_id: 'ex-1', order_index: 0 },

      { id: 'wde-w3-decoy-day', workout_day_id: 'day-w3-decoy', exercise_id: 'ex-other', order_index: 0 },
      { id: 'wde-w3-wrong-order', workout_day_id: 'day-w3', exercise_id: 'ex-1', order_index: 1 },
      { id: 'wde-w3', workout_day_id: 'day-w3', exercise_id: 'ex-1', order_index: 0 },

      { id: 'wde-w4-decoy-day', workout_day_id: 'day-w4-decoy', exercise_id: 'ex-other', order_index: 0 },
      { id: 'wde-w4-wrong-order', workout_day_id: 'day-w4', exercise_id: 'ex-1', order_index: 1 },
      { id: 'wde-w4', workout_day_id: 'day-w4', exercise_id: 'ex-1', order_index: 0 },
    ],
    workout_session: [
      // decoy incomplete session, listed first
      {
        id: 'session-incomplete',
        workout_day_id: 'day-w1',
        completed: false,
        performed_at: '2026-01-01T00:00:00Z',
      },
      { id: 'session-1', workout_day_id: 'day-w1', completed: true, performed_at: '2026-01-02T00:00:00Z' },
    ],
    workout_session_set: [
      // set for a different exercise in the same session, to make sure
      // exercise_id is actually filtered on
      { workout_session_id: 'session-1', exercise_id: 'ex-other', load_kg: 999, reps_done: 10, rir_logged: 2 },
      ...loggedSets.map((set) => ({ workout_session_id: 'session-1', exercise_id: 'ex-1', ...set })),
    ],
  }

  const updates: { table: string; id: string; values: Record<string, unknown> }[] = []

  function makeSelectChain(table: string) {
    let rows = tables[table] ?? []

    const chain = {
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => row[column] === value)
        return chain
      },
      order() {
        return chain
      },
      limit() {
        return chain
      },
      async maybeSingle() {
        return { data: rows[0] ?? null, error: null }
      },
      then(
        onFulfilled: (value: { data: Row[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
      },
    }

    return chain
  }

  const from = vi.fn((table: string) => ({
    select: () => makeSelectChain(table),
    update: (values: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => {
        updates.push({ table, id, values })
        return Promise.resolve({ error: null })
      },
    }),
  }))

  return { supabase: { from } as unknown as SupabaseClient, updates }
}

describe('applyWeek1Progression', () => {
  it('writes progressive loads to weeks 2-4 based on the max load logged in week 1', async () => {
    const { supabase, updates } = makeSupabaseMock()

    await applyWeek1Progression(supabase, 'plan-1')

    const week2 = updates.find((u) => u.id === 'wde-w2')
    const week3 = updates.find((u) => u.id === 'wde-w3')
    const week4 = updates.find((u) => u.id === 'wde-w4')

    expect((week2?.values as { target_load_kg: number }).target_load_kg).toBeCloseTo(47.25)
    expect((week3?.values as { target_load_kg: number }).target_load_kg).toBeCloseTo(49.6125)
    expect((week4?.values as { target_load_kg: number }).target_load_kg).toBeCloseTo(50.852812500000004)

    // decoys (wrong day_label, wrong order_index) must never be updated
    expect(updates.some((u) => u.id.includes('decoy'))).toBe(false)
    expect(updates.some((u) => u.id.includes('wrong-order'))).toBe(false)
  })

  it('keeps the same load instead of progressing when logged reps fell short of the target', async () => {
    const { supabase, updates } = makeSupabaseMock([
      // target_reps is 8; only hitting 5 reps means performance did not
      // justify increasing the load next week
      { load_kg: 40, reps_done: 5, rir_logged: 2 },
      { load_kg: 45, reps_done: 5, rir_logged: 2 },
    ])

    await applyWeek1Progression(supabase, 'plan-1')

    const week2 = updates.find((u) => u.id === 'wde-w2')
    const week3 = updates.find((u) => u.id === 'wde-w3')
    const week4 = updates.find((u) => u.id === 'wde-w4')

    expect((week2?.values as { target_load_kg: number }).target_load_kg).toBe(45)
    expect((week3?.values as { target_load_kg: number }).target_load_kg).toBe(45)
    expect((week4?.values as { target_load_kg: number }).target_load_kg).toBe(45)
  })

  it('keeps the same load instead of progressing when logged RIR was above the prescribed max', async () => {
    const { supabase, updates } = makeSupabaseMock([
      // target_rir max is 3; RIR 5 means they stopped further from failure
      // than prescribed, so performance did not justify increasing the load
      { load_kg: 40, reps_done: 10, rir_logged: 5 },
      { load_kg: 45, reps_done: 10, rir_logged: 5 },
    ])

    await applyWeek1Progression(supabase, 'plan-1')

    const week2 = updates.find((u) => u.id === 'wde-w2')

    expect((week2?.values as { target_load_kg: number }).target_load_kg).toBe(45)
  })
})
