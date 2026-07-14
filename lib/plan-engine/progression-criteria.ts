export type LoggedSet = {
  repsDone: number
  rirLogged: number | null
}

function parseMaxRir(targetRir: string): number {
  const parts = targetRir.split('-').map(Number)
  return Math.max(...parts)
}

export function meetsProgressionCriteria(
  sets: LoggedSet[],
  targetReps: number,
  targetRir: string
): boolean {
  if (sets.length === 0) {
    return false
  }

  const maxRir = parseMaxRir(targetRir)

  return sets.every(
    (set) => set.repsDone >= targetReps && (set.rirLogged == null || set.rirLogged <= maxRir)
  )
}
