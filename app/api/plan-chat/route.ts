import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { determineCurrentWeek } from '@/lib/plan-engine/week-progress'
import { searchExercises, rebuildDay } from '@/lib/plan-engine/rebuild-day'
import { chatWithPlanCoach, type PlanContext, type PlanDay } from '@/lib/openai/plan-chat'
import type { ChatMessage } from '@/lib/openai/client'

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
  7: 'domingo',
}

type RawDay = {
  id: string
  day_label: string
  day_of_week: number | null
  week_number: number
  week_type: string | null
  workout_day_exercise: Array<{ exercise: { name: string; name_pt: string | null } }>
  workout_session: Array<{ completed: boolean }>
}

async function buildPlanContext(
  supabase: SupabaseClient,
  userId: string,
  trainingPlanId: string
): Promise<PlanContext | null> {
  const { data: plan } = await supabase
    .from('training_plan')
    .select('id, user_id, month_number')
    .eq('id', trainingPlanId)
    .maybeSingle()

  if (!plan || plan.user_id !== userId) {
    return null
  }

  const { data: profile } = await supabase
    .from('profile')
    .select('goal, level, days_per_week')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return null
  }

  const { data } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, day_of_week, week_number, week_type, workout_day_exercise(exercise(name, name_pt)), workout_session(completed)'
    )
    .eq('training_plan_id', trainingPlanId)
    .order('week_number')
    .order('day_of_week')

  const allDays = (data ?? []) as unknown as RawDay[]

  const weekCompletion: Record<number, boolean> = {}
  for (let week = 1; week <= 4; week++) {
    const weekDays = allDays.filter((day) => day.week_number === week)
    weekCompletion[week] =
      weekDays.length > 0 && weekDays.every((day) => day.workout_session.some((s) => s.completed))
  }

  const currentWeek = determineCurrentWeek(weekCompletion)

  // A semana atual vai com os exercícios; as outras só com o rótulo do dia.
  // O mês inteiro com exercício estouraria o contexto sem ajudar a planejar.
  const days: PlanDay[] = allDays.map((day) => ({
    workoutDayId: day.id,
    weekNumber: day.week_number,
    weekdayName: day.day_of_week ? WEEKDAY_NAMES[day.day_of_week] : 'sem dia fixo',
    dayLabel: translateDayLabel(day.day_label),
    completed: day.workout_session.some((s) => s.completed),
    isCurrentWeek: day.week_number === currentWeek,
    exercises:
      day.week_number === currentWeek
        ? day.workout_day_exercise.map((item) => item.exercise.name_pt ?? item.exercise.name)
        : [],
  }))

  return {
    goal: profile.goal as string,
    level: profile.level as string,
    daysPerWeek: profile.days_per_week as number,
    monthNumber: (plan.month_number as number) ?? 1,
    currentWeek,
    weekType: allDays.find((day) => day.week_number === currentWeek)?.week_type ?? null,
    days,
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
  }

  const { messages, trainingPlanId } = (await request.json()) as {
    messages: ChatMessage[]
    trainingPlanId: string
  }

  const supabase = createServerSupabaseClient()
  const context = await buildPlanContext(supabase, userId, trainingPlanId)

  const result = await chatWithPlanCoach(messages, context, {
    searchExercises: (criteria) => searchExercises(supabase, criteria),
    // o dono vem sempre da sessão: a IA escolhe o dia, nunca o usuário do dia
    rebuildDay: (workoutDayId, input) => rebuildDay(supabase, workoutDayId, userId, input),
  })

  return NextResponse.json(result)
}
