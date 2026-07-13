export function determineCurrentWeek(weekCompletion: Record<number, boolean>): number {
  for (let week = 1; week <= 4; week++) {
    if (!weekCompletion[week]) {
      return week
    }
  }
  return 4
}
