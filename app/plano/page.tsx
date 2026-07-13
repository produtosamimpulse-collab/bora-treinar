import { createServerSupabaseClient } from '@/lib/supabase/server'
import PlanoInterativo from './PlanoInterativo'

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p>Nenhum plano encontrado.</p>
      </main>
    )
  }

  const supabase = createServerSupabaseClient()

  const { data: days } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, day_of_week, week_number, workout_day_exercise(id, target_sets, target_reps, exercise(id, name, name_pt))'
    )
    .eq('training_plan_id', id)
    .eq('week_number', 1)
    .order('day_of_week')

  const formattedDays = (days ?? []).map((day) => ({
    id: day.id,
    dayLabel: day.day_label,
    dayOfWeek: day.day_of_week,
    exercises: (
      day.workout_day_exercise as unknown as Array<{
        id: string
        target_sets: number
        target_reps: number
        exercise: { id: string; name: string; name_pt: string | null }
      }>
    ).map((item) => ({
      id: item.id,
      exerciseId: item.exercise.id,
      name: item.exercise.name_pt ?? item.exercise.name,
      targetSets: item.target_sets,
      targetReps: item.target_reps,
    })),
  }))

  const dayIds = formattedDays.map((day) => day.id)

  const { data: sessions } = await supabase
    .from('workout_session')
    .select('workout_day_id')
    .eq('completed', true)
    .in('workout_day_id', dayIds.length > 0 ? dayIds : [''])

  const completedDayIds = (sessions ?? []).map((session) => session.workout_day_id as string)

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Semana 1, calibração
        </span>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          Seu <span className="text-brand">plano</span>
        </h1>
      </header>

      <PlanoInterativo days={formattedDays} initialCompletedDayIds={completedDayIds} />
    </main>
  )
}
