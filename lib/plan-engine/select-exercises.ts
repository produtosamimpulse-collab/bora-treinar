import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'

export async function selectExercisesForDay(
  supabase: SupabaseClient,
  day: SplitDay,
  equipmentFilter: string | null,
  count: number
): Promise<{ id: string; name: string }[]> {
  let query = supabase.from('exercise').select('id, name').in('target', day.targets)

  if (equipmentFilter) {
    query = query.eq('equipment', equipmentFilter)
  }

  const { data, error } = await query.limit(count)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
