import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServerSupabaseClient } from '../lib/supabase/server'
import { classifyCardioName } from '../lib/plan-engine/cardio-catalog'

async function main() {
  const supabase = createServerSupabaseClient()

  const allExercises: { id: string; name: string }[] = []
  let offset = 0
  const pageSize = 1000

  for (;;) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name')
      .eq('target', 'cardiovascular system')
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    allExercises.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`Classificando ${allExercises.length} exercícios de cardio...`)

  const matchCountByEntry: Record<string, number> = {}
  let matched = 0

  for (const exercise of allExercises) {
    const entry = classifyCardioName(exercise.name)

    if (!entry) {
      continue
    }

    matched += 1
    matchCountByEntry[entry.namePt] = (matchCountByEntry[entry.namePt] ?? 0) + 1

    const { error } = await supabase
      .from('exercise')
      .update({ is_cardio: true })
      .eq('id', exercise.id)

    if (error) throw new Error(error.message)
  }

  console.log(`\nCasados: ${matched} | Não casados: ${allExercises.length - matched}`)
  console.log('\nContagem por máquina:')
  console.log(JSON.stringify(matchCountByEntry, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
