import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'

export type CardioPrescription = {
  minutes: number
  intensity: string
  everyDay: boolean
}

export type CardioExercise = { id: string; name: string }

type Goal = OnboardingProfile['goal']

const CARDIO_BY_GOAL: Record<Goal, CardioPrescription> = {
  emagrecimento: { minutes: 25, intensity: 'moderada a alta', everyDay: true },
  condicionamento: { minutes: 20, intensity: 'alta (intervalado)', everyDay: true },
  saude_geral: { minutes: 20, intensity: 'moderada', everyDay: false },
  hipertrofia: { minutes: 12, intensity: 'leve', everyDay: false },
}

export function getCardioPrescription(goal: Goal): CardioPrescription {
  return CARDIO_BY_GOAL[goal]
}

export async function selectCardioExercise(
  supabase: SupabaseClient
): Promise<CardioExercise | null> {
  const { data, error } = await supabase
    .from('exercise')
    .select('id, name')
    .eq('is_cardio', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
