import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']
const MAX_OPTIONS = 5

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: current, error: currentError } = await supabase
    .from('workout_day_exercise')
    .select(
      'id, workout_day_id, exercise_id, exercise:exercise_id(target), workout_day:workout_day_id(training_plan:training_plan_id(user_id))'
    )
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const ownerUserId = (
    current.workout_day as unknown as { training_plan: { user_id: string } }
  ).training_plan.user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const { data: usedRows } = await supabase
    .from('workout_day_exercise')
    .select('exercise_id')
    .eq('workout_day_id', current.workout_day_id)

  const usedIds = (usedRows ?? []).map((row) => row.exercise_id)
  const target = (current.exercise as unknown as { target: string }).target

  const { data: candidates, error: candidateError } = await supabase
    .from('exercise')
    .select('id, name, name_pt, equipment')
    .eq('target', target)
    .not('id', 'in', `(${usedIds.join(',')})`)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')

  if (candidateError) {
    throw new Error(candidateError.message)
  }

  // Prioriza variedade: no máximo um exercício por tipo de equipamento
  // primeiro, só repetindo equipamento se faltar opção diferente pra
  // completar 5 - assim as alternativas realmente usam máquinas diferentes,
  // não só variações do mesmo aparelho.
  const seenEquipment = new Set<string>()
  const diverse: typeof candidates = []
  const rest: typeof candidates = []

  for (const candidate of candidates ?? []) {
    const equipment = candidate.equipment ?? ''
    if (!seenEquipment.has(equipment)) {
      seenEquipment.add(equipment)
      diverse.push(candidate)
    } else {
      rest.push(candidate)
    }
  }

  const options = [...diverse, ...rest].slice(0, MAX_OPTIONS)

  return NextResponse.json(
    options.map((option) => ({
      id: option.id,
      name: option.name_pt ?? option.name,
    }))
  )
}
