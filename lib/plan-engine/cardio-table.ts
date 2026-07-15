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

// Teto por objetivo: cardio evolui mês a mês junto com o condicionamento,
// mas nunca a ponto de comprometer a recuperação do treino de força.
const CARDIO_MAX_MINUTES: Record<Goal, number> = {
  emagrecimento: 45,
  condicionamento: 35,
  saude_geral: 30,
  hipertrofia: 20,
}

const MINUTES_INCREMENT_PER_MONTH = 5

export function getCardioPrescription(goal: Goal, monthNumber = 1): CardioPrescription {
  const base = CARDIO_BY_GOAL[goal]
  const monthsElapsed = Math.max(0, monthNumber - 1)
  const minutes = Math.min(
    base.minutes + monthsElapsed * MINUTES_INCREMENT_PER_MONTH,
    CARDIO_MAX_MINUTES[goal]
  )

  return { ...base, minutes }
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
