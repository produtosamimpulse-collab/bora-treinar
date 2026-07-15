import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { determineCurrentWeek } from '@/lib/plan-engine/week-progress'
import { chatWithCoach, type PlanContext } from '@/lib/openai/coach-chat'
import type { ChatMessage } from '@/lib/openai/client'

async function buildPlanContext(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string
): Promise<PlanContext | null> {
  const { data: profile } = await supabase
    .from('profile')
    .select('goal, level, days_per_week')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return null
  }

  const { data: plan } = await supabase
    .from('training_plan')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!plan) {
    return {
      goal: profile.goal,
      level: profile.level,
      daysPerWeek: profile.days_per_week,
      currentWeek: 1,
      weekType: null,
      days: [],
    }
  }

  const { data } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, week_number, week_type, cardio_minutes, cardio_intensity, cardio_exercise:cardio_exercise_id(name, name_pt), workout_day_exercise(target_sets, target_reps, target_rir, exercise(name, name_pt)), workout_session(completed)'
    )
    .eq('training_plan_id', plan.id)

  const allDays = (data ?? []) as unknown as Array<{
    day_label: string
    week_number: number
    week_type: string | null
    cardio_minutes: number | null
    cardio_intensity: string | null
    cardio_exercise: { name: string; name_pt: string | null } | null
    workout_day_exercise: Array<{
      target_sets: number
      target_reps: number
      target_rir: string | null
      exercise: { name: string; name_pt: string | null }
    }>
    workout_session: Array<{ completed: boolean }>
  }>

  const weekCompletion: Record<number, boolean> = {}
  for (let week = 1; week <= 4; week++) {
    const weekDays = allDays.filter((day) => day.week_number === week)
    weekCompletion[week] =
      weekDays.length > 0 && weekDays.every((day) => day.workout_session.some((s) => s.completed))
  }

  const currentWeek = determineCurrentWeek(weekCompletion)
  const currentWeekDays = allDays.filter((day) => day.week_number === currentWeek)

  return {
    goal: profile.goal,
    level: profile.level,
    daysPerWeek: profile.days_per_week,
    currentWeek,
    weekType: currentWeekDays[0]?.week_type ?? null,
    days: currentWeekDays.map((day) => ({
      dayLabel: translateDayLabel(day.day_label),
      exercises: day.workout_day_exercise.map((item) => ({
        name: item.exercise.name_pt ?? item.exercise.name,
        targetSets: item.target_sets,
        targetReps: item.target_reps,
        targetRir: item.target_rir,
      })),
      cardio: day.cardio_exercise
        ? {
            name: day.cardio_exercise.name_pt ?? day.cardio_exercise.name,
            minutes: day.cardio_minutes,
            intensity: day.cardio_intensity,
          }
        : null,
    })),
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = (await request.json()) as { messages: ChatMessage[] }

  const supabase = createServerSupabaseClient()
  const context = await buildPlanContext(supabase, userId)
  const content = await chatWithCoach(messages, context)

  return NextResponse.json({ content })
}
