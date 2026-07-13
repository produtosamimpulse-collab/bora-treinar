import { config } from 'dotenv'
config({ path: '.env.local' })

import { translateExerciseBatch } from '../lib/openai/translate'
import { createServerSupabaseClient } from '../lib/supabase/server'

const BATCH_SIZE = 25

async function main() {
  const supabase = createServerSupabaseClient()

  const { data: pending, error } = await supabase
    .from('exercise')
    .select('id, name, muscle_group, instructions')
    .is('name_pt', null)
    .range(0, 1999)

  if (error) {
    throw new Error(error.message)
  }

  const exercises = pending ?? []
  console.log(`Traduzindo ${exercises.length} exercícios em lotes de ${BATCH_SIZE}...`)

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE)
    const translations = await translateExerciseBatch(batch)

    for (const translation of translations) {
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
    }

    console.log(`Lote ${i / BATCH_SIZE + 1}: ${translations.length} exercícios traduzidos.`)
  }

  console.log('Tradução concluída.')
}

main().catch((error) => {
  console.error('Falha na tradução:', error)
  process.exit(1)
})
