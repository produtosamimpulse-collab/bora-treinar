import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

type ExerciseProgress = {
  name: string
  firstLoad: number
  lastLoad: number
  changed: boolean
}

export default async function ProgressoPage() {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    redirect('/login')
  }

  const supabase = createServerSupabaseClient()

  const { data: plans } = await supabase
    .from('training_plan')
    .select('id, month_number, goal, reference_month')
    .eq('user_id', userId)
    .order('month_number', { ascending: true })

  const planIds = (plans ?? []).map((plan) => plan.id)

  const { data: days } = await supabase
    .from('workout_day')
    .select('id, training_plan_id, workout_session(id, completed, performed_at)')
    .in('training_plan_id', planIds.length > 0 ? planIds : [''])

  const allDays = (days ?? []) as unknown as {
    id: string
    training_plan_id: string
    workout_session: Array<{ id: string; completed: boolean; performed_at: string }>
  }[]

  const monthStats = (plans ?? []).map((plan) => {
    const planDays = allDays.filter((day) => day.training_plan_id === plan.id)
    const completedDays = planDays.filter((day) => day.workout_session.some((s) => s.completed)).length
    return { ...plan, totalDays: planDays.length, completedDays }
  })

  const sessionDateById = new Map<string, string>()
  for (const day of allDays) {
    for (const session of day.workout_session) {
      if (session.completed) {
        sessionDateById.set(session.id, session.performed_at)
      }
    }
  }
  const sessionIds = [...sessionDateById.keys()]

  const { data: sets } = await supabase
    .from('workout_session_set')
    .select('load_kg, workout_session_id, exercise:exercise_id(name, name_pt)')
    .in('workout_session_id', sessionIds.length > 0 ? sessionIds : [''])
    .not('load_kg', 'is', null)

  const entriesByExercise = new Map<string, { date: string; load: number }[]>()
  for (const set of (sets ?? []) as unknown as {
    load_kg: number
    workout_session_id: string
    exercise: { name: string; name_pt: string | null }
  }[]) {
    const date = sessionDateById.get(set.workout_session_id)
    if (!date) continue

    const name = set.exercise.name_pt ?? set.exercise.name
    const list = entriesByExercise.get(name) ?? []
    list.push({ date, load: set.load_kg })
    entriesByExercise.set(name, list)
  }

  const exerciseProgress: ExerciseProgress[] = [...entriesByExercise.entries()]
    .map(([name, entries]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
      const firstDate = sorted[0].date
      const lastDate = sorted[sorted.length - 1].date
      const firstLoad = Math.max(...sorted.filter((e) => e.date === firstDate).map((e) => e.load))
      const lastLoad = Math.max(...sorted.filter((e) => e.date === lastDate).map((e) => e.load))
      return { name, firstLoad, lastLoad, changed: firstDate !== lastDate }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Histórico
        </span>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          Seu <span className="text-brand text-outline">progresso</span>
        </h1>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl uppercase tracking-tight">Meses</h2>

        {monthStats.length === 0 ? (
          <p className="text-sm text-foreground/60">Nenhum mês concluído ainda.</p>
        ) : (
          <ul className="space-y-3">
            {monthStats.map((month) => (
              <li
                key={month.id}
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
                    Mês {month.month_number}
                  </p>
                  <p className="text-sm capitalize">{month.goal.replace('_', ' ')}</p>
                </div>
                <p className="text-sm text-foreground/70">
                  {month.completedDays} de {month.totalDays} dias
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl uppercase tracking-tight">Evolução de carga</h2>

        {exerciseProgress.length === 0 ? (
          <p className="text-sm text-foreground/60">Nenhum treino registrado ainda.</p>
        ) : (
          <ul className="space-y-3">
            {exerciseProgress.map((exercise) => (
              <li
                key={exercise.name}
                className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6"
              >
                <p className="text-sm font-medium capitalize">{exercise.name}</p>
                <p className="text-sm text-foreground/70">
                  {exercise.changed ? (
                    <>
                      {exercise.firstLoad}kg <span className="text-brand text-outline">→</span> {exercise.lastLoad}kg
                    </>
                  ) : (
                    <>{exercise.lastLoad}kg</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
