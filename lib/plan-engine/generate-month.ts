import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { chooseSplit } from './split'
import { selectExercisesForWeek } from './weekly-selection'
import { getVolumeForGoal, getWeeklyVolumeRange, getTargetRir } from './volume-table'
import { getCardioPrescription, selectCardioExercise } from './cardio-table'
import { assignWeekdays } from './weekdays'

type Week1Type = 'calibracao' | 'deload'

type GenerateMonthOptions = {
  monthNumber: number
  week1Type: Week1Type
  referenceMonth: Date
}

async function generateMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile,
  options: GenerateMonthOptions
): Promise<{ trainingPlanId: string }> {
  const split = chooseSplit(profile.days_per_week)
  const volume = getVolumeForGoal(profile.goal)
  const volumeRange = getWeeklyVolumeRange(profile.level)
  const targetRir = getTargetRir(profile.level)
  const weekdays = assignWeekdays(profile.days_per_week)
  const cardioPrescription = getCardioPrescription(profile.goal)
  const cardioExercise = await selectCardioExercise(supabase)

  const weekSelection = await selectExercisesForWeek(
    supabase,
    split.days,
    profile.excluded_targets,
    volumeRange,
    volume.exercisesPerDay
  )

  const { data: trainingPlan, error: planError } = await supabase
    .from('training_plan')
    .insert([
      {
        user_id: userId,
        reference_month: options.referenceMonth.toISOString().slice(0, 10),
        goal: profile.goal,
        periodization_phase: 'acumulacao',
        month_number: options.monthNumber,
      },
    ])
    .select()
    .single()

  if (planError) {
    throw new Error(planError.message)
  }

  const [minReps] = volume.reps.split('-').map(Number)
  // Deload: mesmos exercícios, mesma faixa de carga, mas metade das séries -
  // é o jeito mais comum de reduzir volume numa semana de recuperação sem
  // precisar saber a carga anterior de exercícios que podem ter mudado.
  const deloadSets = Math.max(1, Math.ceil(volume.sets / 2))

  for (let week = 1; week <= 4; week++) {
    const weekType = week === 1 ? options.week1Type : 'progressao'
    const setsForWeek = week === 1 && options.week1Type === 'deload' ? deloadSets : volume.sets

    for (let dayIndex = 0; dayIndex < split.days.length; dayIndex++) {
      const day = split.days[dayIndex]

      // "no momento certo": cardio nunca substitui musculação, só é
      // adicionado como orientação pra depois do treino de força daquele
      // dia. Frequência (todo dia ou dias alternados) varia por objetivo.
      const dayGetsCardio =
        cardioExercise != null && (cardioPrescription.everyDay || dayIndex % 2 === 0)

      const { data: workoutDay, error: dayError } = await supabase
        .from('workout_day')
        .insert([
          {
            training_plan_id: trainingPlan.id,
            week_number: week,
            day_label: day.label,
            day_of_week: weekdays[dayIndex],
            week_type: weekType,
            cardio_exercise_id: dayGetsCardio ? cardioExercise!.id : null,
            cardio_minutes: dayGetsCardio ? cardioPrescription.minutes : null,
            cardio_intensity: dayGetsCardio ? cardioPrescription.intensity : null,
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
        target_sets: setsForWeek,
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

export async function generateFirstMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile
): Promise<{ trainingPlanId: string }> {
  const referenceMonth = new Date()
  referenceMonth.setDate(1)

  return generateMonth(supabase, userId, profile, {
    monthNumber: 1,
    week1Type: 'calibracao',
    referenceMonth,
  })
}

export async function generateNextMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile,
  previousMonthNumber: number
): Promise<{ trainingPlanId: string }> {
  const referenceMonth = new Date()
  referenceMonth.setMonth(referenceMonth.getMonth() + 1)
  referenceMonth.setDate(1)

  return generateMonth(supabase, userId, profile, {
    monthNumber: previousMonthNumber + 1,
    week1Type: 'deload',
    referenceMonth,
  })
}
