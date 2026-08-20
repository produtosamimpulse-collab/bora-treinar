import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { getVolumeForGoal, getTargetRir, type Level } from './volume-table'
import { interleaveByTarget } from './weekly-selection'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']
const MAX_SEARCH_RESULTS = 24
const MAX_PER_TARGET = 8
const MAX_EXERCISES_PER_DAY = 10
const MAX_DAY_LABEL_LENGTH = 60

// Valores reais da coluna `exercise.target` (vocabulário da ExerciseDB),
// conferidos direto no banco. É o vocabulário que o treinador do chat pode
// pedir ao montar um treino sob medida — qualquer outro valor não existe e
// devolveria uma busca vazia.
export const AVAILABLE_TARGETS = [
  'abductors',
  'abs',
  'adductors',
  'biceps',
  'calves',
  'delts',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'pectorals',
  'quads',
  'spine',
  'traps',
  'triceps',
  'upper back',
] as const

export type AvailableTarget = (typeof AVAILABLE_TARGETS)[number]

export type ExerciseSearchResult = {
  id: string
  name: string
  target: string
  mechanic: string
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

// `.or()` do PostgREST usa vírgula, parênteses e ponto como sintaxe: um termo
// de busca vindo da conversa precisa ser limpo antes de entrar no filtro.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()".*\\%]/g, ' ').trim().slice(0, 60)
}

function isCompound(mechanic: string | null): boolean {
  return mechanic === 'composto'
}

// Mesma ordem que o motor usa ao montar um dia: composto primeiro, isolado
// depois — quem exige mais coordenação e carga vem com o aluno descansado.
function orderCompoundFirst<T extends { mechanic: string | null }>(exercises: T[]): T[] {
  return [...exercises].sort((a, b) => {
    if (isCompound(a.mechanic) === isCompound(b.mechanic)) return 0
    return isCompound(a.mechanic) ? -1 : 1
  })
}

/**
 * Busca exercícios do catálogo curado (os que têm `mechanic` preenchido) por
 * grupo muscular, por nome, ou pelos dois. É o que dá ao treinador do chat
 * uma lista real de opções pra montar um treino sob medida, em vez de
 * inventar exercícios que não existem no banco.
 */
export async function searchExercises(
  supabase: SupabaseClient,
  criteria: { targets?: string[]; nameQuery?: string }
): Promise<ExerciseSearchResult[]> {
  const targets = (criteria.targets ?? []).filter((target) =>
    (AVAILABLE_TARGETS as readonly string[]).includes(target)
  )
  const nameQuery = criteria.nameQuery ? sanitizeSearchTerm(criteria.nameQuery) : ''

  if (targets.length === 0 && !nameQuery) {
    return []
  }

  let query = supabase
    .from('exercise')
    .select('id, name, name_pt, target, mechanic')
    .eq('is_cardio', false)
    .not('mechanic', 'is', null)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')

  if (targets.length > 0) {
    query = query.in('target', targets)
  }

  if (nameQuery) {
    query = query.or(`name.ilike.%${nameQuery}%,name_pt.ilike.%${nameQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name_pt as string | null) ?? (row.name as string),
    target: row.target as string,
    mechanic: row.mechanic as string,
  }))

  // Sem o rodízio por grupo, pedir "posterior e glúteo" podia devolver 24
  // exercícios de glúteo e nenhum de posterior — o grupo com mais linhas no
  // banco monopolizaria a lista que o treinador vê.
  const byTargetCap = new Map<string, number>()
  const capped = orderCompoundFirst(rows).filter((row) => {
    const used = byTargetCap.get(row.target) ?? 0
    if (used >= MAX_PER_TARGET) return false
    byTargetCap.set(row.target, used + 1)
    return true
  })

  return interleaveByTarget(capped).slice(0, MAX_SEARCH_RESULTS)
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
    .select('id, name, name_pt, mechanic')
    .in('id', exerciseIds)
    .eq('is_cardio', false)
    .not('mechanic', 'is', null)

  if (chosenError) {
    throw new Error(chosenError.message)
  }

  const found = (chosen ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name_pt as string | null) ?? (row.name as string),
    mechanic: row.mechanic as string,
  }))

  if (found.length !== exerciseIds.length) {
    return { error: 'Algum dos exercícios escolhidos não existe no catálogo' }
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

// Nomes em português dos grupos musculares, pra o treinador do chat traduzir
// o que o aluno fala ("posterior", "glúteo") pro vocabulário da coluna
// `target` sem precisar adivinhar.
export const TARGET_LABELS_PT: Record<AvailableTarget, string> = {
  abductors: 'abdutores',
  abs: 'abdômen',
  adductors: 'adutores',
  biceps: 'bíceps',
  calves: 'panturrilha',
  delts: 'ombros',
  forearms: 'antebraço',
  glutes: 'glúteos',
  hamstrings: 'posterior de coxa',
  lats: 'dorsal (costas)',
  pectorals: 'peito',
  quads: 'quadríceps',
  spine: 'lombar e core',
  traps: 'trapézio',
  triceps: 'tríceps',
  'upper back': 'costas (parte alta)',
}
