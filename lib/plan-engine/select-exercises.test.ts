import { describe, it, expect, vi } from 'vitest'
import { selectExercisesForDay } from './select-exercises'

function makeSupabaseMock(rows: { id: string; name: string }[]) {
  const calls: { method: string; args: unknown[] }[] = []

  const builder = {
    in: (...args: unknown[]) => {
      calls.push({ method: 'in', args })
      return builder
    },
    not: (...args: unknown[]) => {
      calls.push({ method: 'not', args })
      return builder
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: 'eq', args })
      return builder
    },
    limit: (...args: unknown[]) => {
      calls.push({ method: 'limit', args })
      return Promise.resolve({ data: rows, error: null })
    },
  }

  const select = vi.fn().mockReturnValue(builder)
  const from = vi.fn().mockReturnValue({ select })
  return { from, select, calls } as never
}

describe('selectExercisesForDay', () => {
  it('queries the exercise table filtering by target and limiting by count', async () => {
    const rows = [
      { id: '1', name: 'Bench Press' },
      { id: '2', name: 'Push-up' },
    ]
    const supabase = makeSupabaseMock(rows)

    const result = await selectExercisesForDay(
      supabase,
      { label: 'Push', targets: ['chest', 'shoulders', 'triceps'] },
      null,
      2
    )

    expect(supabase.from).toHaveBeenCalledWith('exercise')
    expect(supabase.select).toHaveBeenCalledWith('id, name')
    expect(supabase.calls).toContainEqual({
      method: 'in',
      args: ['target', ['chest', 'shoulders', 'triceps']],
    })
    expect(supabase.calls.some((c) => c.method === 'eq')).toBe(false)
    expect(supabase.calls).toContainEqual({ method: 'limit', args: [2] })
    expect(result).toEqual(rows)
  })

  it('filters by equipment when an equipment filter is given', async () => {
    const rows = [{ id: '1', name: 'Push-up' }]
    const supabase = makeSupabaseMock(rows)

    const result = await selectExercisesForDay(
      supabase,
      { label: 'Push', targets: ['chest'] },
      'body weight',
      3
    )

    expect(supabase.calls).toContainEqual({
      method: 'eq',
      args: ['equipment', 'body weight'],
    })
    expect(supabase.calls).toContainEqual({ method: 'limit', args: [3] })
    expect(result).toEqual(rows)
  })

  it('excludes exercises that require manual assistance or a towel', async () => {
    const supabase = makeSupabaseMock([])

    await selectExercisesForDay(supabase, { label: 'Push', targets: ['chest'] }, null, 5)

    expect(supabase.calls).toContainEqual({
      method: 'not',
      args: ['equipment', 'in', '("assisted","assisted (towel)")'],
    })
    expect(supabase.calls).toContainEqual({
      method: 'not',
      args: ['name', 'ilike', '%towel%'],
    })
  })

  it('throws when the query returns an error', async () => {
    const builder = {
      in: () => builder,
      not: () => builder,
      eq: () => builder,
      limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    }
    const select = vi.fn().mockReturnValue(builder)
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as never

    await expect(
      selectExercisesForDay(supabase, { label: 'Push', targets: ['chest'] }, null, 5)
    ).rejects.toThrow('boom')
  })
})
