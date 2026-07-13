const DIRECT_TRANSLATIONS: Record<string, string> = {
  Push: 'Empurrar',
  Pull: 'Puxar',
  Legs: 'Pernas',
  Upper: 'Superior',
  Lower: 'Inferior',
}

const FULL_BODY_PATTERN = /^Full Body (\d+)$/

export function translateDayLabel(label: string): string {
  if (DIRECT_TRANSLATIONS[label]) {
    return DIRECT_TRANSLATIONS[label]
  }

  const fullBodyMatch = label.match(FULL_BODY_PATTERN)
  if (fullBodyMatch) {
    return `Corpo Inteiro ${fullBodyMatch[1]}`
  }

  return label
}
