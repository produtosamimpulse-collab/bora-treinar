export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs'

export type SplitDay = {
  label: string
  targets: string[]
}

const FULL_BODY_TARGETS = ['chest', 'back', 'upper legs', 'shoulders', 'abs']
const UPPER_TARGETS = ['chest', 'back', 'shoulders', 'triceps', 'biceps']
const LOWER_TARGETS = ['upper legs', 'lower legs', 'abs']
const PUSH_TARGETS = ['chest', 'shoulders', 'triceps']
const PULL_TARGETS = ['back', 'biceps', 'forearms']
const LEGS_TARGETS = ['upper legs', 'lower legs', 'abs']

export function chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] } {
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  if (daysPerWeek <= 3) {
    const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) => ({
      label: `Full Body ${i + 1}`,
      targets: FULL_BODY_TARGETS,
    }))
    return { type: 'full_body', days }
  }

  if (daysPerWeek === 4) {
    const days: SplitDay[] = [
      { label: 'Upper', targets: UPPER_TARGETS },
      { label: 'Lower', targets: LOWER_TARGETS },
      { label: 'Upper', targets: UPPER_TARGETS },
      { label: 'Lower', targets: LOWER_TARGETS },
    ]
    return { type: 'upper_lower', days }
  }

  const cycle: SplitDay[] = [
    { label: 'Push', targets: PUSH_TARGETS },
    { label: 'Pull', targets: PULL_TARGETS },
    { label: 'Legs', targets: LEGS_TARGETS },
  ]
  const days = Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3])
  return { type: 'push_pull_legs', days }
}
