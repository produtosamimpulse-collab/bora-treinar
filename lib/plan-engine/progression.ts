const WEEKLY_INCREMENTS: Record<2 | 3 | 4, number> = {
  2: 0.05,
  3: 0.05,
  4: 0.025,
}

const MAX_SINGLE_STEP_INCREMENT = 0.05

export function calculateProgressiveLoad(week1LoadKg: number, targetWeek: 2 | 3 | 4): number {
  let load = week1LoadKg

  for (let week = 2; week <= targetWeek; week++) {
    const increment = Math.min(
      WEEKLY_INCREMENTS[week as 2 | 3 | 4],
      MAX_SINGLE_STEP_INCREMENT
    )
    load = load * (1 + increment)
  }

  return load
}
