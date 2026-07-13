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

export function planWeekExercises(
  candidatesByDay: CandidateExercise[][],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): CandidateExercise[][] {
  const usedSets: Record<string, number> = {}
  const usedIds = new Set<string>()
  const result: CandidateExercise[][] = []

  for (const dayCandidates of candidatesByDay) {
    const fresh = dayCandidates.filter((candidate) => !usedIds.has(candidate.id))
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
      for (const candidate of dayCandidates) {
        if (chosen.length >= exercisesPerDay) break
        if (chosen.some((c) => c.id === candidate.id)) continue

        const currentSets = usedSets[candidate.target] ?? 0
        if (currentSets >= volumeRange.max) continue

        chosen.push(candidate)
        usedSets[candidate.target] = currentSets + 1
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

export async function fetchCandidatesForDay(
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
