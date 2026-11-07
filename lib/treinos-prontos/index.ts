import { EXERCICIOS } from './exercicios'
import { TREINOS_LAIS } from './treinos-lais'
import { TREINOS_POR_PARTE } from './treinos-por-parte'
import type { Treino } from './tipos'

export type { Exercicio, ItemTreino, Treino } from './tipos'
export { EXERCICIOS }

export const ORDEM_POR_PARTE = ['Superiores', 'Inferiores', 'Glúteo', 'Abdômen', 'Cardio']
export const ORDEM_LAIS = ['Iniciante', 'Adaptação', 'Intermediário', 'Detox']

export const TODOS_OS_TREINOS: Treino[] = [...TREINOS_POR_PARTE, ...TREINOS_LAIS]

export function buscarTreino(slug: string): Treino | undefined {
  return TODOS_OS_TREINOS.find((treino) => treino.slug === slug)
}

export function agruparTreinos(
  colecao: Treino['colecao'],
  ordem: string[]
): Array<{ grupo: string; treinos: Treino[] }> {
  return ordem
    .map((grupo) => ({
      grupo,
      treinos: TODOS_OS_TREINOS.filter((t) => t.colecao === colecao && t.grupo === grupo),
    }))
    .filter((bloco) => bloco.treinos.length > 0)
}

export function ehTempo(repeticoes: string): boolean {
  return /segundo|minuto/.test(repeticoes)
}

export function resumoDoTreino(treino: Treino): string {
  const forca = treino.itens.filter((item) => EXERCICIOS[item.exercicio].grupo !== 'cardio')
  const minutos = Math.round(
    treino.itens.reduce((total, item) => {
      const tempo = item.repeticoes.match(/(\d+)\s*minuto/)
      if (tempo) return total + Number(tempo[1]) * item.series
      return total + item.series * (45 + item.descansoSegundos) / 60
    }, 0)
  )
  const partes = []
  if (forca.length > 0) partes.push(`${forca.length} exercícios`)
  partes.push(`~${minutos} min`)
  return partes.join(' · ')
}
