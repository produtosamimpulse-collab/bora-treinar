export type Exercicio = {
  nome: string
  grupo: string
  midia: string | null
}

export type ItemTreino = {
  exercicio: string
  series: number
  repeticoes: string
  carga: string
  descansoSegundos: number
  observacao?: string
  combinado?: number
}

export type Treino = {
  slug: string
  nome: string
  colecao: 'parte' | 'lais'
  grupo: string
  itens: ItemTreino[]
}
