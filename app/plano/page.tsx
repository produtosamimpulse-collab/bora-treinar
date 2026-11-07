import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { determineCurrentWeek } from '@/lib/plan-engine/week-progress'
import PlanoInterativo from './PlanoInterativo'
import PlanoCoachPanel from './PlanoCoachPanel'

type RawDay = {
  id: string
  day_label: string
  day_of_week: number | null
  week_number: number
  week_type: string | null
  cardio_minutes: number | null
  cardio_intensity: string | null
  cardio_exercise: { name: string; name_pt: string | null } | null
  workout_day_exercise: Array<{
    id: string
    target_sets: number
    target_reps: number
    exercise: { id: string; name: string; name_pt: string | null }
  }>
  workout_session: Array<{ completed: boolean }>
}

const WEEK_TYPE_LABEL: Record<string, string> = {
  calibracao: 'calibração',
  deload: 'semana de recuperação',
}

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    redirect('/login')
  }

  const { id: requestedId } = await searchParams
  const supabase = createServerSupabaseClient()

  let id = requestedId

  if (id) {
    const { data: plan } = await supabase
      .from('training_plan')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()

    if (!plan || plan.user_id !== userId) {
      id = undefined
    }
  }

  if (!id) {
    const { data: latestPlan } = await supabase
      .from('training_plan')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestPlan) {
      return (
        <main className="min-h-dvh bg-background p-6 text-foreground">
          <p>Você ainda não tem um plano.</p>
          <Link href="/onboarding" className="mt-4 inline-block text-brand text-outline underline underline-offset-4">
            Começar meu plano
          </Link>
        </main>
      )
    }

    redirect(`/plano?id=${latestPlan.id}`)
  }

  // Uma única consulta traz tudo (dias, exercícios e sessões das 4 semanas)
  // em vez de idas sequenciais ao banco — o volume de dados de um plano é
  // pequeno o bastante pra filtrar/computar tudo em memória depois.
  const { data } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, day_of_week, week_number, week_type, cardio_minutes, cardio_intensity, cardio_exercise:cardio_exercise_id(name, name_pt), workout_day_exercise(id, target_sets, target_reps, exercise(id, name, name_pt)), workout_session(completed)'
    )
    .eq('training_plan_id', id)
    .order('day_of_week')

  const allDays = (data ?? []) as unknown as RawDay[]

  const weekCompletion: Record<number, boolean> = {}
  for (let week = 1; week <= 4; week++) {
    const weekDays = allDays.filter((day) => day.week_number === week)
    weekCompletion[week] =
      weekDays.length > 0 && weekDays.every((day) => day.workout_session.some((s) => s.completed))
  }

  const currentWeek = determineCurrentWeek(weekCompletion)
  const currentWeekDays = allDays.filter((day) => day.week_number === currentWeek)
  const currentWeekType = currentWeekDays[0]?.week_type ?? null

  // Se a semana 4 terminou, o próximo mês só é gerado depois da avaliação
  // mensal (lib/plan-engine/checkin.ts) - se ele ainda não existe, mostra
  // um aviso pra lembrar o aluno de fazer o check-in.
  let needsCheckin = false

  if (weekCompletion[4]) {
    const { data: planRow } = await supabase
      .from('training_plan')
      .select('month_number')
      .eq('id', id)
      .maybeSingle()

    if (planRow) {
      const { data: nextPlan } = await supabase
        .from('training_plan')
        .select('id')
        .eq('user_id', userId)
        .eq('month_number', planRow.month_number + 1)
        .maybeSingle()

      needsCheckin = !nextPlan
    }
  }

  const formattedDays = currentWeekDays.map((day) => ({
    id: day.id,
    dayLabel: translateDayLabel(day.day_label),
    dayOfWeek: day.day_of_week,
    exercises: day.workout_day_exercise.map((item) => ({
      id: item.id,
      exerciseId: item.exercise.id,
      name: item.exercise.name_pt ?? item.exercise.name,
      targetSets: item.target_sets,
      targetReps: item.target_reps,
    })),
    cardio: day.cardio_exercise
      ? {
          name: day.cardio_exercise.name_pt ?? day.cardio_exercise.name,
          minutes: day.cardio_minutes,
          intensity: day.cardio_intensity,
        }
      : null,
  }))

  const completedDayIds = currentWeekDays
    .filter((day) => day.workout_session.some((s) => s.completed))
    .map((day) => day.id)

  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="mb-3 block text-xs text-foreground/60 underline underline-offset-4">
            ← Treinos
          </Link>
          <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Semana {currentWeek} de 4
            {currentWeekType && WEEK_TYPE_LABEL[currentWeekType] ? `, ${WEEK_TYPE_LABEL[currentWeekType]}` : ''}
          </span>
          <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
            Seu <span className="text-brand text-outline">plano</span>
          </h1>
        </div>
        <Link
          href="/progresso"
          className="mt-1 shrink-0 text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          Progresso
        </Link>
      </header>

      {needsCheckin && (
        <div className="mb-8 rounded-2xl border border-brand/40 bg-surface p-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
            Mês concluído
          </p>
          <p className="mt-2 text-sm text-foreground/70">
            Antes de começar o próximo mês, vamos fazer sua avaliação mensal com o personal.
          </p>
          <Link
            href={`/checkin?planId=${id}`}
            className="mt-4 inline-block min-h-11 rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-black"
          >
            Fazer avaliação mensal
          </Link>
        </div>
      )}

      <PlanoCoachPanel trainingPlanId={id} />

      <PlanoInterativo days={formattedDays} initialCompletedDayIds={completedDayIds} />
    </main>
  )
}
