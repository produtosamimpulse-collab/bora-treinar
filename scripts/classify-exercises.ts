import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServerSupabaseClient } from '../lib/supabase/server'
import { classifyExerciseName } from '../lib/plan-engine/exercise-catalog'

async function main() {
  const supabase = createServerSupabaseClient()

  const allExercises: { id: string; name: string }[] = []
  let offset = 0
  const pageSize = 1000

  for (;;) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name')
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    allExercises.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`Classificando ${allExercises.length} exercícios...`)

  const matchCountByEntry: Record<string, number> = {}
  let matched = 0
  let unmatched = 0

  for (const exercise of allExercises) {
    const entry = classifyExerciseName(exercise.name)

    if (!entry) {
      unmatched += 1
      continue
    }

    matched += 1
    matchCountByEntry[entry.namePt] = (matchCountByEntry[entry.namePt] ?? 0) + 1

    const { error } = await supabase
      .from('exercise')
      .update({ mechanic: entry.mechanic })
      .eq('id', exercise.id)

    if (error) throw new Error(error.message)
  }

  console.log(`\nCasados: ${matched} | Não casados (fora do catálogo, nunca selecionáveis): ${unmatched}`)
  console.log('\nContagem por movimento do catálogo:')
  console.log(JSON.stringify(matchCountByEntry, null, 2))

  const zeroMatchEntries = Object.keys(matchCountByEntry).length
  console.log(`\nMovimentos do catálogo com pelo menos 1 exercício: ${zeroMatchEntries}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
