import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { chooseSplit } from './split'
import { selectExercisesForWeek } from './weekly-selection'
import { getVolumeForGoal, getWeeklyVolumeRange, getTargetRir } from './volume-table'
import { assignWeekdays } from './weekdays'

export async function generateFirstMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile
): Promise<{ trainingPlanId: string }> {
  const split = chooseSplit(profile.days_per_week)
  const volume = getVolumeForGoal(profile.goal)
  const volumeRange = getWeeklyVolumeRange(profile.level)
  const targetRir = getTargetRir(profile.level)
  const weekdays = assignWeekdays(profile.days_per_week)

  const weekSelection = await selectExercisesForWeek(
    supabase,
    split.days,
    profile.excluded_targets,
    volumeRange,
    volume.exercisesPerDay
  )

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

  const [minReps] = volume.reps.split('-').map(Number)

  for (let week = 1; week <= 4; week++) {
    for (let dayIndex = 0; dayIndex < split.days.length; dayIndex++) {
      const day = split.days[dayIndex]

      const { data: workoutDay, error: dayError } = await supabase
        .from('workout_day')
        .insert([
          {
            training_plan_id: trainingPlan.id,
            week_number: week,
            day_label: day.label,
            day_of_week: weekdays[dayIndex],
          },
        ])
        .select()
        .single()

      if (dayError) {
        throw new Error(dayError.message)
      }

      const exercises = weekSelection[dayIndex]

      const dayExerciseRows = exercises.map((exercise, index) => ({
        workout_day_id: workoutDay.id,
        exercise_id: exercise.id,
        order_index: index,
        target_sets: volume.sets,
        target_reps: minReps,
        target_load_kg: null,
        target_rir: targetRir,
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
