import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import ExecucaoGuiada from './ExecucaoGuiada'

export default async function TreinoPage({
  params,
}: {
  params: Promise<{ workoutDayId: string }>
}) {
  const { workoutDayId } = await params
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return (
      <main className="min-h-dvh bg-background p-6 text-foreground">
        <p>Treino não encontrado.</p>
      </main>
    )
  }

  const supabase = createServerSupabaseClient()

  const [{ data: day }, { data: openSession }] = await Promise.all([
    supabase
      .from('workout_day')
      .select(
        'id, day_label, rest_seconds, training_plan:training_plan_id(user_id), workout_day_exercise(id, target_sets, target_reps, target_load_kg, target_rir, exercise(id, name, name_pt))'
      )
      .eq('id', workoutDayId)
      .single(),
    supabase
      .from('workout_session')
      .select('workout_session_set(exercise_id, set_number)')
      .eq('workout_day_id', workoutDayId)
      .eq('completed', false)
      .maybeSingle(),
  ])

  const ownerUserId = day ? (day.training_plan as unknown as { user_id: string }).user_id : null

  if (!day || ownerUserId !== userId) {
    return (
      <main className="min-h-dvh bg-background p-6 text-foreground">
        <p>Treino não encontrado.</p>
      </main>
    )
  }

  const setsDoneByExerciseId: Record<string, number> = {}

  for (const set of (openSession?.workout_session_set ?? []) as Array<{
    exercise_id: string
    set_number: number
  }>) {
    setsDoneByExerciseId[set.exercise_id] = Math.max(
      setsDoneByExerciseId[set.exercise_id] ?? 0,
      set.set_number
    )
  }

  const exercises = (
    day.workout_day_exercise as unknown as Array<{
      id: string
      target_sets: number
      target_reps: number
      target_load_kg: number | null
      target_rir: string | null
      exercise: { id: string; name: string; name_pt: string | null }
    }>
  ).map((item) => ({
    id: item.id,
    exerciseId: item.exercise.id,
    name: item.exercise.name_pt ?? item.exercise.name,
    targetSets: item.target_sets,
    targetReps: item.target_reps,
    targetLoadKg: item.target_load_kg,
    targetRir: item.target_rir as string | null,
    setsDone: setsDoneByExerciseId[item.exercise.id] ?? 0,
  }))

  return (
    <ExecucaoGuiada
      workoutDayId={day.id}
      dayLabel={translateDayLabel(day.day_label)}
      restSeconds={day.rest_seconds}
      exercises={exercises}
    />
  )
}
