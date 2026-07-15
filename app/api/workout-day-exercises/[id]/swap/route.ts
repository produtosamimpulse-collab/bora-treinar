import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { exerciseId } = (await request.json()) as { exerciseId: string }

  if (!exerciseId) {
    return NextResponse.json({ error: 'Missing exerciseId' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { data: current, error: currentError } = await supabase
    .from('workout_day_exercise')
    .select(
      'id, workout_day_id, exercise_id, exercise:exercise_id(target), workout_day:workout_day_id(training_plan:training_plan_id(user_id))'
    )
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const ownerUserId = (
    current.workout_day as unknown as { training_plan: { user_id: string } }
  ).training_plan.user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const target = (current.exercise as unknown as { target: string }).target

  const { data: chosen, error: chosenError } = await supabase
    .from('exercise')
    .select('id, name, name_pt')
    .eq('id', exerciseId)
    .eq('target', target)
    .maybeSingle()

  if (chosenError) {
    throw new Error(chosenError.message)
  }

  if (!chosen) {
    return NextResponse.json({ error: 'Invalid replacement exercise' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('workout_day_exercise')
    .update({ exercise_id: chosen.id })
    .eq('id', id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return NextResponse.json(chosen)
}
