import { config } from 'dotenv'
config({ path: '.env.local' })

import { translateExerciseBatch } from '../lib/openai/translate'
import { createServerSupabaseClient } from '../lib/supabase/server'

const BATCH_SIZE = 25
const FETCH_PAGE_SIZE = 1000 // limite "Max Rows" do PostgREST no projeto Supabase

type PendingExercise = {
  id: string
  name: string
  muscle_group: string
  instructions: string
}

async function fetchAllPending(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<PendingExercise[]> {
  const all: PendingExercise[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name, muscle_group, instructions')
      .is('name_pt', null)
      .range(from, from + FETCH_PAGE_SIZE - 1)

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      break
    }

    all.push(...data)

    if (data.length < FETCH_PAGE_SIZE) {
      break
    }

    from += FETCH_PAGE_SIZE
  }

  return all
}

async function main() {
  const supabase = createServerSupabaseClient()

  const exercises = await fetchAllPending(supabase)
  console.log(`Traduzindo ${exercises.length} exercícios em lotes de ${BATCH_SIZE}...`)

  const validIds = new Set(exercises.map((exercise) => exercise.id))
  let translatedCount = 0
  let skippedCount = 0

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE)
    const translations = await translateExerciseBatch(batch)

    for (const translation of translations) {
      if (!validIds.has(translation.id)) {
        console.error(
          `Ignorando tradução com id inválido/não solicitado: ${JSON.stringify(translation.id)}`
        )
        skippedCount++
        continue
      }

      try {
        const { error: updateError } = await supabase
          .from('exercise')
          .update({
            name_pt: translation.name_pt,
            muscle_group_pt: translation.muscle_group_pt,
            instructions_pt: translation.instructions_pt,
          })
          .eq('id', translation.id)

        if (updateError) {
          throw new Error(updateError.message)
        }

        translatedCount++
      } catch (rowError) {
        console.error(`Falha ao salvar tradução do exercício ${translation.id}:`, rowError)
        skippedCount++
      }
    }

    console.log(`Lote ${i / BATCH_SIZE + 1}: ${translations.length} exercícios recebidos.`)
  }

  console.log(
    `Tradução concluída. ${translatedCount} exercícios salvos, ${skippedCount} ignorados por erro.`
  )
}

main().catch((error) => {
  console.error('Falha na tradução:', error)
  process.exit(1)
})
