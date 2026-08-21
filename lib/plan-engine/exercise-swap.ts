import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCatalogPool } from './catalog-source'
import { MOVEMENTS, findMovementForName, pickVariation, type MuscleGroup } from './movement-catalog'

const MAX_OPTIONS = 5

export type SwapOption = { id: string; name: string }

type OwnedExercise = {
  id: string
  workout_day_id: string
  exerciseName: string
  group: MuscleGroup | null
  movementId: string | null
}

async function findOwnedExercise(
  supabase: SupabaseClient,
  workoutDayExerciseId: string,
  userId: string
): Promise<OwnedExercise | null> {
  const { data: current, error } = await supabase
    .from('workout_day_exercise')
    .select(
      'id, workout_day_id, exercise:exercise_id(name), workout_day:workout_day_id(training_plan:training_plan_id(user_id))'
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

  const exerciseName = (current.exercise as unknown as { name: string }).name
  const movement = findMovementForName(exerciseName)

  return {
    id: current.id,
    workout_day_id: current.workout_day_id,
    exerciseName,
    group: movement?.group ?? null,
    movementId: movement?.id ?? null,
  }
}

/**
 * Alternativas de troca: outros MOVIMENTOS do mesmo grupo muscular, um por
 * movimento. Antes isso vinha do `target` da ExerciseDB e devolvia cinco
 * variações do mesmo aparelho; agora trocar leg press oferece agachamento,
 * hack e cadeira extensora de verdade.
 */
export async function getSwapOptions(
  supabase: SupabaseClient,
  workoutDayExerciseId: string,
  userId: string
): Promise<SwapOption[] | null> {
  const current = await findOwnedExercise(supabase, workoutDayExerciseId, userId)

  if (!current) {
    return null
  }

  if (!current.group) {
    return []
  }

  const { data: usedRows } = await supabase
    .from('workout_day_exercise')
    .select('exercise:exercise_id(name)')
    .eq('workout_day_id', current.workout_day_id)

  const usedMovementIds = new Set(
    (usedRows ?? [])
      .map((row) => findMovementForName((row.exercise as unknown as { name: string }).name)?.id)
      .filter((id): id is string => id != null)
  )

  const pool = await loadCatalogPool(supabase)
  const options: SwapOption[] = []

  for (const movement of MOVEMENTS) {
    if (options.length >= MAX_OPTIONS) break
    if (movement.group !== current.group) continue
    // nunca oferecer como alternativa o próprio movimento que está no treino
    if (movement.id === current.movementId) continue
    if (usedMovementIds.has(movement.id)) continue

    const variation = pickVariation(movement, pool)
    if (!variation) continue

    options.push({ id: variation.id, name: movement.namePt })
  }

  return options
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
    .maybeSingle()

  if (chosenError) {
    throw new Error(chosenError.message)
  }

  if (!chosen) {
    return { error: 'Invalid replacement exercise' }
  }

  const movement = findMovementForName(chosen.name as string)

  // A troca continua presa ao mesmo grupo muscular: é o que impede o chat de
  // transformar um dia de perna em dia de bíceps trocando exercício por
  // exercício, sem passar pelo refazer_treino_do_dia.
  if (!movement || (current.group && movement.group !== current.group)) {
    return { error: 'Invalid replacement exercise' }
  }

  const { error: updateError } = await supabase
    .from('workout_day_exercise')
    .update({ exercise_id: chosen.id })
    .eq('id', workoutDayExerciseId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return { id: chosen.id as string, name: movement.namePt, name_pt: movement.namePt }
}
