function hoje(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function chaveSeries(slug: string): string {
  return `bt:series:${slug}:${hoje()}`
}

export function lerSeriesFeitas(slug: string): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(chaveSeries(slug)) ?? '{}')
  } catch {
    return {}
  }
}

export function salvarSeriesFeitas(slug: string, feitas: Record<number, number>): void {
  try {
    localStorage.setItem(chaveSeries(slug), JSON.stringify(feitas))
  } catch {}
}

export function marcarFeito(slug: string): void {
  try {
    localStorage.setItem(`bt:feito:${slug}`, hoje())
  } catch {}
}

export function lerUltimoFeito(slug: string): string | null {
  try {
    const data = localStorage.getItem(`bt:feito:${slug}`)
    if (!data) return null
    const [, mes, dia] = data.split('-')
    return `${dia}/${mes}`
  } catch {
    return null
  }
}
