import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { getSwapOptions, applySwap } from '@/lib/plan-engine/exercise-swap'
import { chatWithCoach, type DayContext } from '@/lib/openai/coach-chat'
import type { ChatMessage } from '@/lib/openai/client'

async function buildDayContext(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  workoutDayId: string
): Promise<DayContext | null> {
  const { data: profile } = await supabase
    .from('profile')
    .select('goal, level')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return null
  }

  const { data: day } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, training_plan:training_plan_id(user_id), workout_day_exercise(id, target_sets, target_reps, target_rir, exercise(name, name_pt))'
    )
    .eq('id', workoutDayId)
    .maybeSingle()

  if (!day) {
    return null
  }

  const ownerUserId = (day.training_plan as unknown as { user_id: string }).user_id

  if (ownerUserId !== userId) {
    return null
  }

  const exercises = (
    day.workout_day_exercise as unknown as Array<{
      id: string
      target_sets: number
      target_reps: number
      target_rir: string | null
      exercise: { name: string; name_pt: string | null }
    }>
  ).map((item) => ({
    workoutDayExerciseId: item.id,
    name: item.exercise.name_pt ?? item.exercise.name,
    targetSets: item.target_sets,
    targetReps: item.target_reps,
    targetRir: item.target_rir,
  }))

  return {
    goal: profile.goal,
    level: profile.level,
    dayLabel: translateDayLabel(day.day_label as string),
    exercises,
  }
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, workoutDayId } = (await request.json()) as {
    messages: ChatMessage[]
    workoutDayId: string
  }

  const supabase = createServerSupabaseClient()
  const context = await buildDayContext(supabase, userId, workoutDayId)

  const result = await chatWithCoach(messages, context, {
    listAlternatives: (workoutDayExerciseId) => getSwapOptions(supabase, workoutDayExerciseId, userId),
    applySwap: (workoutDayExerciseId, exerciseId) =>
      applySwap(supabase, workoutDayExerciseId, exerciseId, userId),
  })

  return NextResponse.json(result)
}
