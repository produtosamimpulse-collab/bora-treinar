import { config } from 'dotenv'
config({ path: '.env.local' })

import { fetchAllExercises } from '../lib/exercisedb/client'
import { mapToExerciseRow } from '../lib/exercisedb/map'
import { createServerSupabaseClient } from '../lib/supabase/server'

async function main() {
  console.log('Buscando exercícios na ExerciseDB...')
  const exercises = await fetchAllExercises()
  console.log(`Recebidos ${exercises.length} exercícios da API.`)

  const rows = exercises.map(mapToExerciseRow)

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('exercise')
    .upsert(rows, { onConflict: 'external_id' })

  if (error) {
    throw error
  }

  console.log(`Sincronizados ${rows.length} exercícios no Supabase.`)
}

main().catch((error) => {
  console.error('Falha na sincronização:', error)
  process.exit(1)
})
