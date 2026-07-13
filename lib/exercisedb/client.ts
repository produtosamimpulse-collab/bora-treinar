export type ExerciseDbExercise = {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
  description: string
  difficulty: string
  category: string
}

const PAGE_SIZE = 10
const MAX_OFFSET = 5000 // safety valve: ~500 pages, well past the ~1300-exercise catalog

export async function fetchAllExercises(): Promise<ExerciseDbExercise[]> {
  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const headers = {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': apiHost,
  }

  const all: ExerciseDbExercise[] = []
  let offset = 0

  while (true) {
    const response = await fetch(
      `https://${apiHost}/exercises?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers }
    )

    if (!response.ok) {
      throw new Error(`ExerciseDB request failed: ${response.status}`)
    }

    const page: ExerciseDbExercise[] = await response.json()
    all.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE

    if (offset > MAX_OFFSET) {
      throw new Error(`ExerciseDB pagination exceeded ${MAX_OFFSET} offset without a final page`)
    }
  }

  return all
}
