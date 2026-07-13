import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { chooseSplit } from './split'
import { selectExercisesForDay } from './select-exercises'
import { getVolumeForGoal } from './volume-table'

export async function generateFirstMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile
): Promise<{ trainingPlanId: string }> {
  const split = chooseSplit(profile.days_per_week)
  const volume = getVolumeForGoal(profile.goal)

  const referenceMonth = new Date()
  referenceMonth.setDate(1)

  const { data: trainingPlan, error: planError } = await supabase
    .from('training_plan')
    .insert([
      {
        user_id: userId,
        reference_month: referenceMonth.toISOString().slice(0, 10),
        goal: profile.goal,
        periodization_phase: 'acumulacao',
      },
    ])
    .select()
    .single()

  if (planError) {
    throw new Error(planError.message)
  }

  for (let week = 1; week <= 4; week++) {
    for (const day of split.days) {
      const { data: workoutDay, error: dayError } = await supabase
        .from('workout_day')
        .insert([
          {
            training_plan_id: trainingPlan.id,
            week_number: week,
            day_label: day.label,
          },
        ])
        .select()
        .single()

      if (dayError) {
        throw new Error(dayError.message)
      }

      const exercises = await selectExercisesForDay(
        supabase,
        day,
        null,
        volume.exercisesPerDay
      )

      const [minReps] = volume.reps.split('-').map(Number)

      const dayExerciseRows = exercises.map((exercise, index) => ({
        workout_day_id: workoutDay.id,
        exercise_id: exercise.id,
        order_index: index,
        target_sets: volume.sets,
        target_reps: minReps,
        target_load_kg: null,
      }))

      const { error: exerciseError } = await supabase
        .from('workout_day_exercise')
        .insert(dayExerciseRows)

      if (exerciseError) {
        throw new Error(exerciseError.message)
      }
    }
  }

  return { trainingPlanId: trainingPlan.id }
}
