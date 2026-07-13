import type { OnboardingProfile } from '../openai/client'

type Volume = {
  sets: number
  reps: string
  exercisesPerDay: number
}

export type Level = 'iniciante' | 'intermediario' | 'avancado'

const VOLUME_BY_GOAL: Record<OnboardingProfile['goal'], Volume> = {
  hipertrofia: { sets: 4, reps: '8-12', exercisesPerDay: 6 },
  emagrecimento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  condicionamento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  saude_geral: { sets: 3, reps: '10-12', exercisesPerDay: 5 },
}

const WEEKLY_VOLUME_RANGE: Record<Level, { min: number; max: number }> = {
  iniciante: { min: 8, max: 12 },
  intermediario: { min: 12, max: 16 },
  avancado: { min: 16, max: 20 },
}

const TARGET_RIR: Record<Level, string> = {
  iniciante: '2-3',
  intermediario: '1-2',
  avancado: '0-2',
}

export function getVolumeForGoal(goal: OnboardingProfile['goal']): Volume {
  return VOLUME_BY_GOAL[goal]
}

export function getWeeklyVolumeRange(level: Level): { min: number; max: number } {
  return WEEKLY_VOLUME_RANGE[level]
}

export function getTargetRir(level: Level): string {
  return TARGET_RIR[level]
}
