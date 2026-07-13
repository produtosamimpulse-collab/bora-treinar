// Cobre tanto os labels originais em inglês quanto a primeira rodada de
// tradução curta em português (Empurrar/Puxar/Pernas/Superior/Inferior) —
// planos gerados em qualquer uma dessas fases devem exibir os nomes
// descritivos atuais.
const DIRECT_TRANSLATIONS = new Map<string, string>([
  ['Push', 'Peito, Ombros e Tríceps'],
  ['Pull', 'Costas e Bíceps'],
  ['Legs', 'Pernas e Glúteos'],
  ['Upper', 'Peito, Costas e Ombros'],
  ['Lower', 'Pernas e Glúteos'],
  ['Empurrar', 'Peito, Ombros e Tríceps'],
  ['Puxar', 'Costas e Bíceps'],
  ['Pernas', 'Pernas e Glúteos'],
  ['Superior', 'Peito, Costas e Ombros'],
  ['Inferior', 'Pernas e Glúteos'],
])

const FULL_BODY_PATTERN = /^Full Body (\d+)$/

export function translateDayLabel(label: string): string {
  const direct = DIRECT_TRANSLATIONS.get(label)
  if (direct) {
    return direct
  }

  const fullBodyMatch = label.match(FULL_BODY_PATTERN)
  if (fullBodyMatch) {
    return `Corpo Inteiro ${fullBodyMatch[1]}`
  }

  return label
}
