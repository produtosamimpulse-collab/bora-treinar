import { describe, it, expect, vi } from 'vitest'
import { selectExercisesForDay } from './select-exercises'

function makeSupabaseMock(rows: { id: string; name: string }[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
  const inFilter = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ in: inFilter })
  const from = vi.fn().mockReturnValue({ select })
  return { from } as never
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
    expect(result).toEqual(rows)
  })

  it('throws when the query returns an error', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const inFilter = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ in: inFilter })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as never

    await expect(
      selectExercisesForDay(supabase, { label: 'Push', targets: ['chest'] }, null, 5)
    ).rejects.toThrow('boom')
  })
})
