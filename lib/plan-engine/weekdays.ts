const PATTERNS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
}

export function assignWeekdays(daysPerWeek: number): number[] {
  const pattern = PATTERNS[daysPerWeek]

  if (!pattern) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  return pattern
}
