import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateProgressiveLoad } from './progression'

export async function applyWeek1Progression(
  supabase: SupabaseClient,
  trainingPlanId: string
): Promise<void> {
  const { data: week1Days } = await supabase
    .from('workout_day')
    .select('id, day_label')
    .eq('training_plan_id', trainingPlanId)
    .eq('week_number', 1)

  for (const day of week1Days ?? []) {
    const { data: exercises } = await supabase
      .from('workout_day_exercise')
      .select('id, exercise_id, order_index')
      .eq('workout_day_id', day.id)

    const { data: session } = await supabase
      .from('workout_session')
      .select('id')
      .eq('workout_day_id', day.id)
      .eq('completed', true)
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      continue
    }

    for (const exercise of exercises ?? []) {
      const { data: sets } = await supabase
        .from('workout_session_set')
        .select('load_kg')
        .eq('workout_session_id', session.id)
        .eq('exercise_id', exercise.exercise_id)

      const loads = (sets ?? [])
        .map((set) => set.load_kg as number | null)
        .filter((load): load is number => load != null)

      if (loads.length === 0) {
        continue
      }

      const baseLoad = Math.max(...loads)

      for (const week of [2, 3, 4] as const) {
        const { data: futureDay } = await supabase
          .from('workout_day')
          .select('id')
          .eq('training_plan_id', trainingPlanId)
          .eq('week_number', week)
          .eq('day_label', day.day_label)
          .maybeSingle()

        if (!futureDay) {
          continue
        }

        const { data: futureExercise } = await supabase
          .from('workout_day_exercise')
          .select('id')
          .eq('workout_day_id', futureDay.id)
          .eq('order_index', exercise.order_index)
          .maybeSingle()

        if (!futureExercise) {
          continue
        }

        const newLoad = calculateProgressiveLoad(baseLoad, week)

        await supabase
          .from('workout_day_exercise')
          .update({ target_load_kg: newLoad })
          .eq('id', futureExercise.id)
      }
    }
  }
}
