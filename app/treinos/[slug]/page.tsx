import { notFound } from 'next/navigation'
import { EXERCICIOS, TODOS_OS_TREINOS, buscarTreino } from '@/lib/treinos-prontos'
import ExecucaoPronta from './ExecucaoPronta'

export function generateStaticParams() {
  return TODOS_OS_TREINOS.map((treino) => ({ slug: treino.slug }))
}

export default async function TreinoProntoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const treino = buscarTreino(slug)

  if (!treino) {
    notFound()
  }

  const titulo = treino.colecao === 'lais' ? `${treino.grupo} · ${treino.nome}` : treino.nome
  const itens = treino.itens.map((item) => ({ ...item, ...EXERCICIOS[item.exercicio] }))

  return <ExecucaoPronta slug={treino.slug} titulo={titulo} itens={itens} />
}
