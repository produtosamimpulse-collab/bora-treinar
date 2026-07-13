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

export async function fetchAllExercises(): Promise<ExerciseDbExercise[]> {
  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const response = await fetch(`https://${apiHost}/exercises?limit=2000`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': apiHost,
    },
  })

  if (!response.ok) {
    throw new Error(`ExerciseDB request failed: ${response.status}`)
  }

  return response.json()
}
