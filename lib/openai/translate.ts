import OpenAI from 'openai'

export type ExerciseToTranslate = {
  id: string
  name: string
  muscle_group: string
  instructions: string
}

export type TranslatedExercise = {
  id: string
  name_pt: string
  muscle_group_pt: string
  instructions_pt: string
}

export async function translateExerciseBatch(
  exercises: ExerciseToTranslate[]
): Promise<TranslatedExercise[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  if (exercises.length === 0) {
    return []
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: 'gpt-5.4-nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você traduz nomes, grupos musculares e instruções de exercícios de academia do inglês para português do Brasil, de forma natural e direta (sem traduzir literalmente termos técnicos consagrados quando não fizer sentido). Responda SOMENTE com um JSON no formato {"translations": [{"id": string, "name_pt": string, "muscle_group_pt": string, "instructions_pt": string}]}, mantendo o "id" original de cada exercício.',
      },
      {
        role: 'user',
        content: JSON.stringify(exercises),
      },
    ],
  })

  const content = completion.choices[0].message.content ?? '{"translations": []}'
  const parsed = JSON.parse(content) as { translations: TranslatedExercise[] }

  return parsed.translations
}
