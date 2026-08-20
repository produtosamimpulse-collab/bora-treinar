import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { getSwapOptions, applySwap } from '@/lib/plan-engine/exercise-swap'
import { searchExercises, rebuildDay } from '@/lib/plan-engine/rebuild-day'
import { getVolumeForGoal } from '@/lib/plan-engine/volume-table'
import type { OnboardingProfile } from '@/lib/openai/client'
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
    exercisesPerDay: getVolumeForGoal(profile.goal as OnboardingProfile['goal']).exercisesPerDay,
    exercises,
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
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
    searchExercises: (criteria) => searchExercises(supabase, criteria),
    rebuildDay: (input) => rebuildDay(supabase, workoutDayId, userId, input),
  })

  return NextResponse.json(result)
}
