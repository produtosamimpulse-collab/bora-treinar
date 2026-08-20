import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateProgressiveLoad } from './progression'
import { meetsProgressionCriteria } from './progression-criteria'

export async function applyWeek1Progression(
  supabase: SupabaseClient,
  trainingPlanId: string
): Promise<void> {
  const { data: week1Days } = await supabase
    .from('workout_day')
    .select('id, day_of_week')
    .eq('training_plan_id', trainingPlanId)
    .eq('week_number', 1)

  for (const day of week1Days ?? []) {
    const { data: exercises } = await supabase
      .from('workout_day_exercise')
      .select('id, exercise_id, order_index, target_reps, target_rir')
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
        .select('load_kg, reps_done, rir_logged')
        .eq('workout_session_id', session.id)
        .eq('exercise_id', exercise.exercise_id)

      const loads = (sets ?? [])
        .map((set) => set.load_kg as number | null)
        .filter((load): load is number => load != null)

      if (loads.length === 0) {
        continue
      }

      const baseLoad = Math.max(...loads)

      // Só aumenta a carga se o desempenho registrado justificar: todas as
      // séries completando o topo da faixa de repetições com RIR igual ou
      // menor que o prescrito. Sem isso, mantém a mesma carga da semana
      // anterior em vez de progredir às cegas.
      const criteriaMet = meetsProgressionCriteria(
        (sets ?? []).map((set) => ({
          repsDone: set.reps_done as number,
          rirLogged: set.rir_logged as number | null,
        })),
        exercise.target_reps as number,
        exercise.target_rir as string
      )

      for (const week of [2, 3, 4] as const) {
        const { data: futureDay } = await supabase
          .from('workout_day')
          .select('id')
          .eq('training_plan_id', trainingPlanId)
          .eq('week_number', week)
          .eq('day_of_week', day.day_of_week)
          .maybeSingle()

        if (!futureDay) {
          continue
        }

        // Casa também por exercise_id: depois que o aluno refaz um dia pelo
        // chat, o slot de mesmo order_index nas semanas seguintes pode ser
        // outro exercício - e carga de agachamento não vale pra stiff.
        const { data: futureExercise } = await supabase
          .from('workout_day_exercise')
          .select('id')
          .eq('workout_day_id', futureDay.id)
          .eq('order_index', exercise.order_index)
          .eq('exercise_id', exercise.exercise_id)
          .maybeSingle()

        if (!futureExercise) {
          continue
        }

        const newLoad = criteriaMet ? calculateProgressiveLoad(baseLoad, week) : baseLoad

        await supabase
          .from('workout_day_exercise')
          .update({ target_load_kg: newLoad })
          .eq('id', futureExercise.id)
      }
    }
  }
}
