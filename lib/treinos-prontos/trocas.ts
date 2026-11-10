import { EXERCICIOS } from './exercicios'

export function opcoesDeTroca(atual: string, usados: string[]): string[] {
  const grupo = EXERCICIOS[atual]?.grupo
  if (!grupo) return []

  const mesmoGrupo = Object.keys(EXERCICIOS).filter((slug) => slug !== atual && EXERCICIOS[slug].grupo === grupo)

  const livres = mesmoGrupo.filter((slug) => !usados.includes(slug))
  if (livres.length > 0) return livres

  return mesmoGrupo
}
