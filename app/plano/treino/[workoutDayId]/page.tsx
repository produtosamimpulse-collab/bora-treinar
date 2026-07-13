import { createServerSupabaseClient } from '@/lib/supabase/server'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import ExecucaoGuiada from './ExecucaoGuiada'

export default async function TreinoPage({
  params,
}: {
  params: Promise<{ workoutDayId: string }>
}) {
  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, rest_seconds, workout_day_exercise(id, target_sets, target_reps, target_load_kg, target_rir, exercise(id, name, name_pt))'
    )
    .eq('id', workoutDayId)
    .single()

  if (!day) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p>Treino não encontrado.</p>
      </main>
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
