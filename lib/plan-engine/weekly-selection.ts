import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'
import type { Mechanic } from './exercise-catalog'
import { loadCatalogPool } from './catalog-source'
import {
  MOVEMENTS,
  pickVariation,
  type CatalogExercise,
  type MuscleGroup,
} from './movement-catalog'

export type CandidateExercise = {
  id: string
  name: string
  group: MuscleGroup
  movementId: string
  mechanic: Mechanic
}

export type VolumeRange = { min: number; max: number }

// O perfil guarda o que o aluno pediu pra evitar em texto livre, vindo da
// conversa de onboarding ("quads", "perna", "ombro"). Aceita tanto o nome do
// grupo do catálogo quanto os apelidos mais comuns e o vocabulário antigo da
// ExerciseDB, que é o que está salvo nos perfis criados antes.
const GROUP_ALIASES: Record<string, MuscleGroup> = {
  chest: 'peito', pectorals: 'peito', peitoral: 'peito',
  back: 'costas', lats: 'costas', 'upper back': 'costas', dorsal: 'costas',
  delts: 'ombro', shoulders: 'ombro', ombros: 'ombro', traps: 'ombro', trapezio: 'ombro',
  biceps: 'biceps', triceps: 'triceps',
  quads: 'quadriceps', quadriceps: 'quadriceps', perna: 'quadriceps', pernas: 'quadriceps', legs: 'quadriceps',
  hamstrings: 'posterior', posterior: 'posterior', isquiotibiais: 'posterior',
  glutes: 'gluteo', gluteo: 'gluteo', gluteos: 'gluteo', abductors: 'gluteo', adductors: 'gluteo',
  calves: 'panturrilha', panturrilha: 'panturrilha',
  abs: 'core', core: 'core', abdomen: 'core', spine: 'core', lombar: 'core',
  forearms: 'antebraco', antebraco: 'antebraco',
}

export function normalizeExcludedGroups(excluded: string[]): MuscleGroup[] {
  const normalized = new Set<MuscleGroup>()

  for (const entry of excluded) {
    const key = entry
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    const group = GROUP_ALIASES[key]
    if (group) normalized.add(group)
  }

  return [...normalized]
}

function interleaveByGroup(candidates: CandidateExercise[]): CandidateExercise[] {
  const byGroup = new Map<string, CandidateExercise[]>()
  for (const candidate of candidates) {
    const group = byGroup.get(candidate.group) ?? []
    group.push(candidate)
    byGroup.set(candidate.group, group)
  }

  const groups = [...byGroup.values()]
  const result: CandidateExercise[] = []
  let round = 0

  while (result.length < candidates.length) {
    let addedInRound = false

    for (const group of groups) {
      if (round < group.length) {
        result.push(group[round])
        addedInRound = true
      }
    }

    if (!addedInRound) break
    round += 1
  }

  return result
}

export function planWeekExercises(
  candidatesByDay: CandidateExercise[][],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): CandidateExercise[][] {
  const usedSets: Record<string, number> = {}
  const usedMovements = new Set<string>()
  const result: CandidateExercise[][] = []

  for (const dayCandidates of candidatesByDay) {
    const fresh = interleaveByGroup(
      dayCandidates.filter((candidate) => !usedMovements.has(candidate.movementId))
    )
    const chosen: CandidateExercise[] = []

    const take = (candidate: CandidateExercise, respectCap: boolean): boolean => {
      if (chosen.some((item) => item.movementId === candidate.movementId)) return false

      const currentSets = usedSets[candidate.group] ?? 0
      if (respectCap && currentSets >= volumeRange.max) return false

      chosen.push(candidate)
      usedSets[candidate.group] = currentSets + 1
      usedMovements.add(candidate.movementId)
      return true
    }

    // passo 1: movimentos ainda não usados na semana, respeitando o teto de volume
    for (const candidate of fresh) {
      if (chosen.length >= exercisesPerDay) break
      take(candidate, true)
    }

    // passo 2: permite repetir movimento já usado antes na semana
    if (chosen.length < exercisesPerDay) {
      for (const candidate of interleaveByGroup(dayCandidates)) {
        if (chosen.length >= exercisesPerDay) break
        take(candidate, true)
      }
    }

    // passo 3: ignora o teto de volume pra nunca entregar um dia curto
    if (chosen.length < exercisesPerDay) {
      for (const candidate of dayCandidates) {
        if (chosen.length >= exercisesPerDay) break
        take(candidate, false)
      }
    }

    const ordered = [...chosen].sort((a, b) => {
      if (a.mechanic === b.mechanic) return 0
      return a.mechanic === 'composto' ? -1 : 1
    })

    result.push(ordered)
  }

  return result
}

export function candidatesForDay(
  day: SplitDay,
  pool: CatalogExercise[],
  excludedGroups: MuscleGroup[]
): CandidateExercise[] {
  const groups = day.groups.filter((group) => !excludedGroups.includes(group))
  const candidates: CandidateExercise[] = []

  for (const movement of MOVEMENTS) {
    if (!groups.includes(movement.group)) continue

    const variation = pickVariation(movement, pool)
    if (!variation) continue

    candidates.push({
      id: variation.id,
      name: movement.namePt,
      group: movement.group,
      movementId: movement.id,
      mechanic: movement.mechanic,
    })
  }

  // composto primeiro: são os que devem ocupar as primeiras vagas do dia
  return candidates.sort((a, b) => {
    if (a.mechanic === b.mechanic) return 0
    return a.mechanic === 'composto' ? -1 : 1
  })
}

export async function selectExercisesForWeek(
  supabase: SupabaseClient,
  days: SplitDay[],
  excludedTargets: string[],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): Promise<CandidateExercise[][]> {
  const pool = await loadCatalogPool(supabase)
  const excludedGroups = normalizeExcludedGroups(excludedTargets)
  const candidatesByDay = days.map((day) => candidatesForDay(day, pool, excludedGroups))

  return planWeekExercises(candidatesByDay, volumeRange, exercisesPerDay)
}
