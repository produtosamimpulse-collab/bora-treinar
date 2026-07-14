import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'
import type { Mechanic } from './exercise-catalog'

export type CandidateExercise = {
  id: string
  name: string
  target: string
  secondaryMuscles: string[]
  mechanic: Mechanic
}

export type VolumeRange = { min: number; max: number }

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']

// Sem isso, a ordem crua da consulta (sem ORDER BY) podia concentrar um dia
// inteiro num único grupo muscular (ex.: só peito) quando esse grupo
// aparecia primeiro nas linhas retornadas. Reordena os candidatos em
// rodízio por `target`, garantindo que nenhum grupo monopolize as vagas do
// dia antes dos outros grupos terem chance.
function interleaveByTarget(candidates: CandidateExercise[]): CandidateExercise[] {
  const byTarget = new Map<string, CandidateExercise[]>()
  for (const candidate of candidates) {
    const group = byTarget.get(candidate.target) ?? []
    group.push(candidate)
    byTarget.set(candidate.target, group)
  }

  const groups = [...byTarget.values()]
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
  const usedIds = new Set<string>()
  const result: CandidateExercise[][] = []

  for (const dayCandidates of candidatesByDay) {
    const fresh = interleaveByTarget(dayCandidates.filter((candidate) => !usedIds.has(candidate.id)))
    const chosen: CandidateExercise[] = []

    // passo 1: só candidatos ainda não usados esta semana, respeitando o teto de volume
    for (const candidate of fresh) {
      if (chosen.length >= exercisesPerDay) break

      const currentSets = usedSets[candidate.target] ?? 0
      if (currentSets >= volumeRange.max) continue

      chosen.push(candidate)
      usedSets[candidate.target] = currentSets + 1
      for (const secondary of candidate.secondaryMuscles) {
        usedSets[secondary] = (usedSets[secondary] ?? 0) + 0.5
      }
      usedIds.add(candidate.id)
    }

    // passo 2 (fallback): ainda faltam vagas - permite repetir um exercício já
    // usado antes na semana, mas ainda respeitando o teto de volume
    if (chosen.length < exercisesPerDay) {
      for (const candidate of interleaveByTarget(dayCandidates)) {
        if (chosen.length >= exercisesPerDay) break
        if (chosen.some((c) => c.id === candidate.id)) continue

        const currentSets = usedSets[candidate.target] ?? 0
        if (currentSets >= volumeRange.max) continue

        chosen.push(candidate)
        usedSets[candidate.target] = currentSets + 1
        for (const secondary of candidate.secondaryMuscles) {
          usedSets[secondary] = (usedSets[secondary] ?? 0) + 0.5
        }
        usedIds.add(candidate.id)
      }
    }

    // passo 3 (fallback final): ainda faltam vagas - ignora o teto de volume
    // também, pra nunca deixar um dia com menos exercícios do que o pedido
    if (chosen.length < exercisesPerDay) {
      for (const candidate of dayCandidates) {
        if (chosen.length >= exercisesPerDay) break
        if (chosen.some((c) => c.id === candidate.id)) continue
        chosen.push(candidate)
        usedIds.add(candidate.id)
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

async function fetchCandidatesForDay(
  supabase: SupabaseClient,
  day: SplitDay,
  excludedTargets: string[]
): Promise<CandidateExercise[]> {
  const targets = day.targets.filter((target) => !excludedTargets.includes(target))

  if (targets.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('exercise')
    .select('id, name, target, secondary_muscles, mechanic')
    .in('target', targets)
    .not('mechanic', 'is', null)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    target: row.target as string,
    secondaryMuscles: (row.secondary_muscles as string[] | null) ?? [],
    mechanic: row.mechanic as Mechanic,
  }))
}

export async function selectExercisesForWeek(
  supabase: SupabaseClient,
  days: SplitDay[],
  excludedTargets: string[],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): Promise<CandidateExercise[][]> {
  const candidatesByDay = await Promise.all(
    days.map((day) => fetchCandidatesForDay(supabase, day, excludedTargets))
  )

  return planWeekExercises(candidatesByDay, volumeRange, exercisesPerDay)
}
