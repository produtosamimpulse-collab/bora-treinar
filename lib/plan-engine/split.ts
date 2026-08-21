import type { MuscleGroup } from './movement-catalog'

export type SplitType = 'full_body' | 'upper_lower'

export type SplitDay = {
  label: string
  groups: MuscleGroup[]
}

// Grupos do catálogo de movimentos (movement-catalog.ts), não os `target` da
// ExerciseDB — lá agachamento livre, hack e leg press estão todos como
// "glutes", o que deixava um dia de perna sem os movimentos principais.
const FULL_BODY_GROUPS: MuscleGroup[] = ['peito', 'costas', 'quadriceps', 'posterior', 'ombro', 'core']
const UPPER_GROUPS: MuscleGroup[] = ['peito', 'costas', 'ombro', 'triceps', 'biceps']
const LOWER_GROUPS: MuscleGroup[] = ['quadriceps', 'posterior', 'gluteo', 'panturrilha', 'core']

export function chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] } {
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  if (daysPerWeek <= 3) {
    const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) => ({
      label: `Corpo Inteiro ${i + 1}`,
      groups: FULL_BODY_GROUPS,
    }))
    return { type: 'full_body', days }
  }

  // Alterna superior/inferior pra qualquer frequência de 4+ dias, em vez de
  // um ciclo push/pull/legs de 3 dias — que em frequências não múltiplas de
  // 3 (como 5 dias) sobrecarrega a parte superior do corpo (2x push + 2x
  // pull contra só 1x legs) e deixa pernas malfeitas.
  const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) =>
    i % 2 === 0
      ? { label: 'Peito, Costas e Ombros', groups: UPPER_GROUPS }
      : { label: 'Pernas e Glúteos', groups: LOWER_GROUPS }
  )
  return { type: 'upper_lower', days }
}
