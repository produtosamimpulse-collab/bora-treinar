import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workoutDayId: string }> }
) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
  }

  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day, error: dayError } = await supabase
    .from('workout_day')
    .select('id, training_plan:training_plan_id(user_id)')
    .eq('id', workoutDayId)
    .single()

  if (dayError || !day) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const ownerUserId = (day.training_plan as unknown as { user_id: string }).user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const { exerciseId, setNumber, repsDone, loadKg, rirLogged } = (await request.json()) as {
    exerciseId: string
    setNumber: number
    repsDone: number
    loadKg: number | null
    rirLogged: number | null
  }

  const { data: existingSession } = await supabase
    .from('workout_session')
    .select('id')
    .eq('workout_day_id', workoutDayId)
    .eq('completed', false)
    .maybeSingle()

  let sessionId = existingSession?.id

  if (!sessionId) {
    const { data: newSession, error: sessionError } = await supabase
      .from('workout_session')
      .insert([{ user_id: userId, workout_day_id: workoutDayId, completed: false }])
      .select()
      .single()

    if (sessionError || !newSession) {
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }

    sessionId = newSession.id
  }

  const { error: setError } = await supabase.from('workout_session_set').insert([
    {
      workout_session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps_done: repsDone,
      load_kg: loadKg,
      rir_logged: rirLogged,
    },
  ])

  if (setError) {
    throw new Error(setError.message)
  }

  return NextResponse.json({ sessionId })
}
