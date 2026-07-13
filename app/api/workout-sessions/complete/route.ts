import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutDayId } = (await request.json()) as { workoutDayId: string }

  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('workout_session')
    .insert([{ user_id: userId, workout_day_id: workoutDayId, completed: true }])

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ ok: true })
}
