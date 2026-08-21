import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { getVolumeForGoal, getTargetRir, type Level } from './volume-table'
import {
  MOVEMENTS,
  MUSCLE_GROUPS,
  BEACH_QUALITIES,
  pickVariation,
  findMovementForName,
  type BeachQuality,
  type CatalogExercise,
  type Movement,
  type MuscleGroup,
} from './movement-catalog'
import { loadCatalogPool } from './catalog-source'

const MAX_SEARCH_RESULTS = 24
const MAX_EXERCISES_PER_DAY = 10
const MAX_DAY_LABEL_LENGTH = 60

export type CatalogOption = {
  id: string
  name: string
  variationName: string
  group: MuscleGroup
  mechanic: string
  movementId: string
}

export type RebuiltExercise = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetRir: string | null
}

export type RebuiltDay = {
  dayLabel: string
  exercises: RebuiltExercise[]
}

export type RebuildError = { error: string }

function toOption(movement: Movement, exercise: CatalogExercise): CatalogOption {
  return {
    id: exercise.id,
    name: movement.namePt,
    variationName: exercise.namePt ?? exercise.name,
    group: movement.group,
    mechanic: movement.mechanic,
    movementId: movement.id,
  }
}

function orderCompoundFirst<T extends { mechanic: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const compound = (item: T) => (item.mechanic === 'composto' ? 0 : 1)
    return compound(a) - compound(b)
  })
}

// Rodízio entre grupos: pedir "peito e tríceps" não pode devolver a lista
// inteira de peito antes do primeiro tríceps.
function interleaveByGroup(options: CatalogOption[]): CatalogOption[] {
  const byGroup = new Map<string, CatalogOption[]>()
  for (const option of options) {
    const group = byGroup.get(option.group) ?? []
    group.push(option)
    byGroup.set(option.group, group)
  }

  const groups = [...byGroup.values()]
  const result: CatalogOption[] = []
  let round = 0

  while (result.length < options.length) {
    let added = false
    for (const group of groups) {
      if (round < group.length) {
        result.push(group[round])
        added = true
      }
    }
    if (!added) break
    round += 1
  }

  return result
}

/**
 * Lista os movimentos tradicionais de academia disponíveis, já resolvidos
 * para um exercício real do banco. É o que o treinador do chat enxerga: uma
 * opção por movimento ("Leg press 45°"), não doze variações do mesmo aparelho.
 */
export async function searchExercises(
  supabase: SupabaseClient,
  criteria: { groups?: string[]; nameQuery?: string; beach?: string[] }
): Promise<CatalogOption[]> {
  const groups = (criteria.groups ?? []).filter((group) =>
    (MUSCLE_GROUPS as readonly string[]).includes(group)
  ) as MuscleGroup[]
  const beach = (criteria.beach ?? []).filter((quality) =>
    (BEACH_QUALITIES as readonly string[]).includes(quality)
  ) as BeachQuality[]
  const nameQuery = (criteria.nameQuery ?? '').trim().toLowerCase()

  if (groups.length === 0 && beach.length === 0 && !nameQuery) {
    return []
  }

  const pool = await loadCatalogPool(supabase)

  const selected = MOVEMENTS.filter((movement) => {
    if (groups.length > 0 && !groups.includes(movement.group)) return false
    if (beach.length > 0 && !(movement.beach ?? []).some((quality) => beach.includes(quality))) {
      return false
    }
    return true
  })

  const options: CatalogOption[] = []

  for (const movement of selected) {
    const variation = pickVariation(movement, pool)
    if (!variation) continue

    const option = toOption(movement, variation)

    if (nameQuery) {
      const haystack = `${option.name} ${option.variationName} ${variation.name}`.toLowerCase()
      if (!haystack.includes(nameQuery)) continue
    }

    options.push(option)
  }

  return interleaveByGroup(orderCompoundFirst(options)).slice(0, MAX_SEARCH_RESULTS)
}

type DayRow = {
  id: string
  day_label: string
  week_type: string | null
  completed: boolean
}

async function findOwnedDay(
  supabase: SupabaseClient,
  workoutDayId: string,
  userId: string
): Promise<DayRow | null> {
  const { data, error } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, week_type, training_plan:training_plan_id(user_id), workout_session(completed)'
    )
    .eq('id', workoutDayId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const ownerUserId = (data.training_plan as unknown as { user_id: string } | null)?.user_id

  if (ownerUserId !== userId) {
    return null
  }

  const sessions = (data.workout_session as unknown as Array<{ completed: boolean }>) ?? []

  return {
    id: data.id as string,
    day_label: data.day_label as string,
    week_type: data.week_type as string | null,
    completed: sessions.some((session) => session.completed),
  }
}

/**
 * Substitui todos os exercícios de um dia pelos exercícios escolhidos.
 *
 * A prescrição (séries, repetições e RIR) continua vindo da tabela de volume
 * do objetivo e do nível do aluno — o que fica livre é *quais* exercícios
 * entram, não o quanto se treina. Semana de deload continua com metade das
 * séries, igual ao mês gerado pelo motor.
 */
export async function rebuildDay(
  supabase: SupabaseClient,
  workoutDayId: string,
  userId: string,
  input: { exerciseIds: string[]; dayLabel?: string }
): Promise<RebuiltDay | RebuildError> {
  const day = await findOwnedDay(supabase, workoutDayId, userId)

  if (!day) {
    return { error: 'Treino não encontrado' }
  }

  if (day.completed) {
    return {
      error:
        'Esse treino já foi concluído e o histórico de cargas está registrado nele, então não dá pra refazer. Dá pra montar o treino novo no próximo dia do plano.',
    }
  }

  const exerciseIds = [...new Set(input.exerciseIds ?? [])]

  if (exerciseIds.length === 0) {
    return { error: 'Nenhum exercício informado' }
  }

  if (exerciseIds.length > MAX_EXERCISES_PER_DAY) {
    return { error: `Um treino pode ter no máximo ${MAX_EXERCISES_PER_DAY} exercícios` }
  }

  const { data: profile } = await supabase
    .from('profile')
    .select('goal, level')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return { error: 'Perfil não encontrado' }
  }

  const { data: chosen, error: chosenError } = await supabase
    .from('exercise')
    .select('id, name, name_pt')
    .in('id', exerciseIds)
    .eq('is_cardio', false)

  if (chosenError) {
    throw new Error(chosenError.message)
  }

  // Só entra no treino o que o catálogo de movimentos reconhece como
  // exercício tradicional de academia. É o que impede o agente de montar um
  // dia com agachamento ajoelhado ou lunge no degrau.
  const found: Array<{ id: string; name: string; mechanic: string }> = []

  for (const row of chosen ?? []) {
    const movement = findMovementForName(row.name as string)
    if (!movement) continue

    found.push({ id: row.id as string, name: movement.namePt, mechanic: movement.mechanic })
  }

  if (found.length !== exerciseIds.length) {
    return {
      error:
        'Algum dos exercícios escolhidos não é um exercício tradicional do catálogo. Use os IDs que vieram de buscar_exercicios.',
    }
  }

  const volume = getVolumeForGoal(profile.goal as OnboardingProfile['goal'])
  const targetRir = getTargetRir(profile.level as Level)
  const [minReps] = volume.reps.split('-').map(Number)
  const setsForDay =
    day.week_type === 'deload' ? Math.max(1, Math.ceil(volume.sets / 2)) : volume.sets

  const ordered = orderCompoundFirst(found)

  const { error: deleteError } = await supabase
    .from('workout_day_exercise')
    .delete()
    .eq('workout_day_id', workoutDayId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  // target_load_kg volta pra null de propósito: a carga guardada ali era a
  // progressão calculada pro exercício antigo daquele slot e não diz nada
  // sobre o exercício novo.
  const rows = ordered.map((exercise, index) => ({
    workout_day_id: workoutDayId,
    exercise_id: exercise.id,
    order_index: index,
    target_sets: setsForDay,
    target_reps: minReps,
    target_load_kg: null,
    target_rir: targetRir,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('workout_day_exercise')
    .insert(rows)
    .select('id, exercise_id, order_index, target_sets, target_reps, target_rir')

  if (insertError) {
    throw new Error(insertError.message)
  }

  const newLabel = input.dayLabel?.trim().slice(0, MAX_DAY_LABEL_LENGTH)

  if (newLabel && newLabel !== day.day_label) {
    const { error: labelError } = await supabase
      .from('workout_day')
      .update({ day_label: newLabel })
      .eq('id', workoutDayId)

    if (labelError) {
      throw new Error(labelError.message)
    }
  }

  const nameByExerciseId = new Map(ordered.map((exercise) => [exercise.id, exercise.name]))

  const exercises: RebuiltExercise[] = [...(inserted ?? [])]
    .sort((a, b) => (a.order_index as number) - (b.order_index as number))
    .map((row) => ({
      id: row.id as string,
      exerciseId: row.exercise_id as string,
      name: nameByExerciseId.get(row.exercise_id as string) ?? '',
      targetSets: row.target_sets as number,
      targetReps: row.target_reps as number,
      targetRir: (row.target_rir as string | null) ?? null,
    }))

  return {
    dayLabel: newLabel || day.day_label,
    exercises,
  }
}
