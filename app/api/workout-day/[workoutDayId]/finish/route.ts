import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { applyWeek1Progression } from '@/lib/plan-engine/apply-progression'
import { generateNextMonth } from '@/lib/plan-engine/generate-month'
import type { OnboardingProfile } from '@/lib/openai/client'

async function isWeekComplete(
  supabase: SupabaseClient,
  trainingPlanId: string,
  weekNumber: number
): Promise<boolean> {
  const { data: weekDays } = await supabase
    .from('workout_day')
    .select('id, workout_session(completed)')
    .eq('training_plan_id', trainingPlanId)
    .eq('week_number', weekNumber)

  return (weekDays ?? []).every((weekDay) =>
    (weekDay.workout_session as unknown as { completed: boolean }[]).some((s) => s.completed)
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workoutDayId: string }> }
) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day, error: dayError } = await supabase
    .from('workout_day')
    .select('id, week_number, training_plan_id, training_plan:training_plan_id(user_id)')
    .eq('id', workoutDayId)
    .single()

  if (dayError || !day) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const ownerUserId = (day.training_plan as unknown as { user_id: string }).user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  await supabase
    .from('workout_session')
    .update({ completed: true })
    .eq('workout_day_id', workoutDayId)
    .eq('completed', false)

  if (day.week_number === 1) {
    if (await isWeekComplete(supabase, day.training_plan_id, 1)) {
      await applyWeek1Progression(supabase, day.training_plan_id)
    }
  }

  let monthCompleted = false

  if (day.week_number === 4) {
    if (await isWeekComplete(supabase, day.training_plan_id, 4)) {
      monthCompleted = true

      const { data: plan } = await supabase
        .from('training_plan')
        .select('month_number')
        .eq('id', day.training_plan_id)
        .single()

      const { data: profileRow } = await supabase
        .from('profile')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (plan && profileRow) {
        const profile: OnboardingProfile = {
          goal: profileRow.goal,
          level: profileRow.level,
          days_per_week: profileRow.days_per_week,
          equipment: profileRow.equipment,
          restrictions: profileRow.restrictions,
          session_minutes: profileRow.session_minutes,
          age: profileRow.age,
          sex: profileRow.sex,
          training_history: profileRow.training_history,
          excluded_targets: profileRow.excluded_targets ?? [],
        }

        await generateNextMonth(supabase, userId, profile, plan.month_number)
      }
    }
  }

  return NextResponse.json({ ok: true, monthCompleted })
}
