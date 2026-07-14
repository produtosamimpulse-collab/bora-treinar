export type SplitType = 'full_body' | 'upper_lower'

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

  // Alterna superior/inferior pra qualquer frequência de 4+ dias, em vez de
  // um ciclo push/pull/legs de 3 dias — que em frequências não múltiplas de
  // 3 (como 5 dias) sobrecarrega a parte superior do corpo (2x push + 2x
  // pull contra só 1x legs) e deixa pernas malfeitas.
  const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) =>
    i % 2 === 0
      ? { label: 'Peito, Costas e Ombros', targets: UPPER_TARGETS }
      : { label: 'Pernas e Glúteos', targets: LOWER_TARGETS }
  )
  return { type: 'upper_lower', days }
}
