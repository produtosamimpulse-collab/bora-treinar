import type { SupabaseClient } from '@supabase/supabase-js'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']
const MAX_OPTIONS = 5

export type SwapOption = { id: string; name: string }

type OwnedExercise = {
  id: string
  workout_day_id: string
  target: string
}

async function findOwnedExercise(
  supabase: SupabaseClient,
  workoutDayExerciseId: string,
  userId: string
): Promise<OwnedExercise | null> {
  const { data: current, error } = await supabase
    .from('workout_day_exercise')
    .select(
      'id, workout_day_id, exercise:exercise_id(target), workout_day:workout_day_id(training_plan:training_plan_id(user_id))'
    )
    .eq('id', workoutDayExerciseId)
    .single()

  if (error || !current) {
    return null
  }

  const ownerUserId = (
    current.workout_day as unknown as { training_plan: { user_id: string } }
  ).training_plan.user_id

  if (ownerUserId !== userId) {
    return null
  }

  return {
    id: current.id,
    workout_day_id: current.workout_day_id,
    target: (current.exercise as unknown as { target: string }).target,
  }
}

export async function getSwapOptions(
  supabase: SupabaseClient,
  workoutDayExerciseId: string,
  userId: string
): Promise<SwapOption[] | null> {
  const current = await findOwnedExercise(supabase, workoutDayExerciseId, userId)

  if (!current) {
    return null
  }

  const { data: usedRows } = await supabase
    .from('workout_day_exercise')
    .select('exercise_id')
    .eq('workout_day_id', current.workout_day_id)

  const usedIds = (usedRows ?? []).map((row) => row.exercise_id)

  const { data: candidates, error: candidateError } = await supabase
    .from('exercise')
    .select('id, name, name_pt, equipment')
    .eq('target', current.target)
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

  return options.map((option) => ({
    id: option.id,
    name: option.name_pt ?? option.name,
  }))
}

export async function applySwap(
  supabase: SupabaseClient,
  workoutDayExerciseId: string,
  exerciseId: string,
  userId: string
): Promise<{ id: string; name: string; name_pt: string | null } | { error: string }> {
  const current = await findOwnedExercise(supabase, workoutDayExerciseId, userId)

  if (!current) {
    return { error: 'Exercise not found' }
  }

  const { data: chosen, error: chosenError } = await supabase
    .from('exercise')
    .select('id, name, name_pt')
    .eq('id', exerciseId)
    .eq('target', current.target)
    .maybeSingle()

  if (chosenError) {
    throw new Error(chosenError.message)
  }

  if (!chosen) {
    return { error: 'Invalid replacement exercise' }
  }

  const { error: updateError } = await supabase
    .from('workout_day_exercise')
    .update({ exercise_id: chosen.id })
    .eq('id', workoutDayExerciseId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return chosen
}
