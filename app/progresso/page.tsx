import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

type MonthPoint = { month: number; load: number }

type ExerciseProgress = {
  name: string
  points: MonthPoint[]
}

function ProgressChart({ points }: { points: MonthPoint[] }) {
  const width = 300
  const height = 90
  const padding = 20

  const months = points.map((p) => p.month)
  const loads = points.map((p) => p.load)
  const minLoad = Math.min(...loads)
  const maxLoad = Math.max(...loads)
  const loadRange = maxLoad - minLoad || 1
  const minMonth = Math.min(...months)
  const maxMonth = Math.max(...months)
  const monthRange = maxMonth - minMonth || 1

  const coords = points.map((p) => ({
    x: padding + ((p.month - minMonth) / monthRange) * (width - padding * 2),
    y: height - padding - ((p.load - minLoad) / loadRange) * (height - padding * 2),
    month: p.month,
    load: p.load,
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Gráfico de evolução de carga por mês"
    >
      <path d={pathD} fill="none" stroke="#c8ff00" strokeWidth="2" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="3.5" fill="#0a0a0a" />
          <text x={c.x} y={c.y - 8} fontSize="9" textAnchor="middle" fill="#0a0a0a">
            {c.load}kg
          </text>
          <text x={c.x} y={height - 4} fontSize="9" textAnchor="middle" fill="#666">
            Mês {c.month}
          </text>
        </g>
      ))}
    </svg>
  )
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
  const monthByPlanId = new Map((plans ?? []).map((plan) => [plan.id, plan.month_number]))

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

  const monthBySessionId = new Map<string, number>()
  for (const day of allDays) {
    const month = monthByPlanId.get(day.training_plan_id)
    if (month == null) continue
    for (const session of day.workout_session) {
      if (session.completed) {
        monthBySessionId.set(session.id, month)
      }
    }
  }
  const sessionIds = [...monthBySessionId.keys()]

  const { data: sets } = await supabase
    .from('workout_session_set')
    .select('load_kg, workout_session_id, exercise:exercise_id(name, name_pt)')
    .in('workout_session_id', sessionIds.length > 0 ? sessionIds : [''])
    .not('load_kg', 'is', null)

  const loadByExerciseAndMonth = new Map<string, Map<number, number>>()
  for (const set of (sets ?? []) as unknown as {
    load_kg: number
    workout_session_id: string
    exercise: { name: string; name_pt: string | null }
  }[]) {
    const month = monthBySessionId.get(set.workout_session_id)
    if (month == null) continue

    const name = set.exercise.name_pt ?? set.exercise.name
    const byMonth = loadByExerciseAndMonth.get(name) ?? new Map<number, number>()
    byMonth.set(month, Math.max(byMonth.get(month) ?? 0, set.load_kg))
    loadByExerciseAndMonth.set(name, byMonth)
  }

  const exerciseProgress: ExerciseProgress[] = [...loadByExerciseAndMonth.entries()]
    .map(([name, byMonth]) => ({
      name,
      points: [...byMonth.entries()]
        .map(([month, load]) => ({ month, load }))
        .sort((a, b) => a.month - b.month),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const chartable = exerciseProgress.filter((exercise) => exercise.points.length >= 2)
  const singlePoint = exerciseProgress.filter((exercise) => exercise.points.length === 1)

  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <a
          href="/plano"
          className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          ← Voltar pro plano
        </a>
        <span className="mb-3 mt-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
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
        <h2 className="mb-4 font-display text-xl uppercase tracking-tight">Evolução de carga por mês</h2>

        {chartable.length === 0 && singlePoint.length === 0 ? (
          <p className="text-sm text-foreground/60">Nenhum treino registrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {chartable.map((exercise) => (
              <div
                key={exercise.name}
                className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6"
              >
                <p className="mb-2 text-sm font-medium capitalize">{exercise.name}</p>
                <ProgressChart points={exercise.points} />
              </div>
            ))}

            {singlePoint.length > 0 && (
              <div className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-foreground/60">
                  Ainda sem mês suficiente pra gráfico
                </p>
                <ul className="space-y-2">
                  {singlePoint.map((exercise) => (
                    <li key={exercise.name} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{exercise.name}</span>
                      <span className="text-foreground/70">{exercise.points[0].load}kg</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
