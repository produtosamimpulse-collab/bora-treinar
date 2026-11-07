import { EXERCICIOS } from './exercicios'

const PARECIDOS: Record<string, string[]> = {
  posterior: ['gluteo'],
  panturrilha: ['quadriceps'],
  corpo_todo: ['cardio'],
  cardio: ['corpo_todo'],
  mobilidade: [],
}

const MINIMO_DE_OPCOES = 4

export function opcoesDeTroca(atual: string, usados: string[]): string[] {
  const grupo = EXERCICIOS[atual]?.grupo
  if (!grupo) return []

  const livres = Object.keys(EXERCICIOS).filter((slug) => slug !== atual && !usados.includes(slug))
  const mesmos = livres.filter((slug) => EXERCICIOS[slug].grupo === grupo)
  if (mesmos.length >= MINIMO_DE_OPCOES) return mesmos

  const extras = livres.filter((slug) => (PARECIDOS[grupo] ?? []).includes(EXERCICIOS[slug].grupo))
  return [...mesmos, ...extras]
}
