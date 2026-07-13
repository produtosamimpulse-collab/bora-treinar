import type { OnboardingProfile } from '../openai/client'

type Volume = {
  sets: number
  reps: string
  exercisesPerDay: number
}

const VOLUME_BY_GOAL: Record<OnboardingProfile['goal'], Volume> = {
  hipertrofia: { sets: 4, reps: '8-12', exercisesPerDay: 6 },
  emagrecimento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  condicionamento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  saude_geral: { sets: 3, reps: '10-12', exercisesPerDay: 5 },
}

export function getVolumeForGoal(goal: OnboardingProfile['goal']): Volume {
  return VOLUME_BY_GOAL[goal]
}
