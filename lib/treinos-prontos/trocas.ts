import { EXERCICIOS } from './exercicios'

const PARECIDOS: Record<string, string[]> = {
  peito: ['ombro', 'triceps'],
  costas: ['biceps', 'ombro'],
  ombro: ['peito', 'triceps'],
  triceps: ['peito', 'ombro'],
  biceps: ['costas', 'ombro'],
  quadriceps: ['gluteo', 'posterior'],
  posterior: ['gluteo', 'quadriceps'],
  gluteo: ['posterior', 'quadriceps'],
  adutores: ['gluteo', 'quadriceps'],
  panturrilha: ['quadriceps'],
  abdomen: ['corpo_todo'],
  corpo_todo: ['cardio', 'abdomen'],
  cardio: ['corpo_todo'],
  mobilidade: ['cardio'],
}

const MINIMO_DE_OPCOES = 4

export function opcoesDeTroca(atual: string, usados: string[]): string[] {
  const grupo = EXERCICIOS[atual]?.grupo
  if (!grupo) return []

  const outros = Object.keys(EXERCICIOS).filter((slug) => slug !== atual)
  const relacionados = PARECIDOS[grupo] ?? []

  const mesmoGrupoLivre = outros.filter((slug) => EXERCICIOS[slug].grupo === grupo && !usados.includes(slug))
  if (mesmoGrupoLivre.length >= MINIMO_DE_OPCOES) return mesmoGrupoLivre

  const parecidosLivres = outros.filter((slug) => !usados.includes(slug) && relacionados.includes(EXERCICIOS[slug].grupo))
  const livres = [...mesmoGrupoLivre, ...parecidosLivres]
  if (livres.length > 0) return livres

  const mesmoGrupoUsado = outros.filter((slug) => EXERCICIOS[slug].grupo === grupo)
  if (mesmoGrupoUsado.length > 0) return mesmoGrupoUsado

  return outros.filter((slug) => relacionados.includes(EXERCICIOS[slug].grupo))
}
