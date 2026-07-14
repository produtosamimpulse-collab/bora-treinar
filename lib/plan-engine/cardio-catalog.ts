export type CardioEntry = {
  namePt: string
  keywords: string[]
}

const CARDIO_CATALOG: CardioEntry[] = [
  { namePt: 'Esteira', keywords: ['treadmill'] },
  { namePt: 'Bicicleta ergométrica', keywords: ['stationary bike', 'exercise bike'] },
  { namePt: 'Elíptico', keywords: ['elliptical'] },
  { namePt: 'Escada (stairmaster)', keywords: ['stepmill', 'stairmaster', 'stair climber'] },
  { namePt: 'Remo ergômetro', keywords: ['rowing machine', 'rower'] },
]

export function classifyCardioName(name: string): CardioEntry | null {
  const lower = name.toLowerCase()

  for (const entry of CARDIO_CATALOG) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      return entry
    }
  }

  return null
}
