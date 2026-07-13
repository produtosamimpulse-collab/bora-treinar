import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { applyWeek1Progression } from '@/lib/plan-engine/apply-progression'

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
    const { data: week1Days } = await supabase
      .from('workout_day')
      .select('id, workout_session(completed)')
      .eq('training_plan_id', day.training_plan_id)
      .eq('week_number', 1)

    const allComplete = (week1Days ?? []).every((weekDay) =>
      (weekDay.workout_session as unknown as { completed: boolean }[]).some((s) => s.completed)
    )

    if (allComplete) {
      await applyWeek1Progression(supabase, day.training_plan_id)
    }
  }

  return NextResponse.json({ ok: true })
}
