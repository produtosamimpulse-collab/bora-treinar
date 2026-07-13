import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { userId, workoutDayId } = (await request.json()) as {
    userId: string
    workoutDayId: string
  }

  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('workout_session')
    .insert([{ user_id: userId, workout_day_id: workoutDayId, completed: true }])

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ ok: true })
}
