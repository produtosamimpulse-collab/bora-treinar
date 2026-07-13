const DIRECT_TRANSLATIONS = new Map<string, string>([
  ['Push', 'Empurrar'],
  ['Pull', 'Puxar'],
  ['Legs', 'Pernas'],
  ['Upper', 'Superior'],
  ['Lower', 'Inferior'],
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
