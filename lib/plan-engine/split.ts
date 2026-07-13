export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs'

export type SplitDay = {
  label: string
  targets: string[]
}

// Valores reais da coluna `exercise.target` (vocabulário da ExerciseDB,
// confirmado consultando os 1394 exercícios sincronizados) — não são os
// mesmos valores de `exercise.muscle_group` (que vem de `bodyPart`, ex:
// "chest", "back"). Ver docs/superpowers/plans/2026-07-13-melhorias-plano-treino.md
// para o contexto da correção.
const FULL_BODY_TARGETS = ['pectorals', 'lats', 'quads', 'delts', 'abs', 'glutes', 'hamstrings']
const UPPER_TARGETS = ['pectorals', 'lats', 'upper back', 'delts', 'triceps', 'biceps', 'traps']
const LOWER_TARGETS = ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'adductors']
const PUSH_TARGETS = ['pectorals', 'delts', 'triceps']
const PULL_TARGETS = ['lats', 'upper back', 'biceps', 'forearms', 'traps']
const LEGS_TARGETS = ['quads', 'hamstrings', 'glutes', 'calves', 'abs']

export function chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] } {
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  if (daysPerWeek <= 3) {
    const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) => ({
      label: `Corpo Inteiro ${i + 1}`,
      targets: FULL_BODY_TARGETS,
    }))
    return { type: 'full_body', days }
  }

  if (daysPerWeek === 4) {
    const days: SplitDay[] = [
      { label: 'Superior', targets: UPPER_TARGETS },
      { label: 'Inferior', targets: LOWER_TARGETS },
      { label: 'Superior', targets: UPPER_TARGETS },
      { label: 'Inferior', targets: LOWER_TARGETS },
    ]
    return { type: 'upper_lower', days }
  }

  const cycle: SplitDay[] = [
    { label: 'Empurrar', targets: PUSH_TARGETS },
    { label: 'Puxar', targets: PULL_TARGETS },
    { label: 'Pernas', targets: LEGS_TARGETS },
  ]
  const days = Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3])
  return { type: 'push_pull_legs', days }
}
