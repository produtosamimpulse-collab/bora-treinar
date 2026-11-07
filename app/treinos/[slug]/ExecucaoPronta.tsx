'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Confetti from '@/app/components/Confetti'
import { EXERCICIOS, type Exercicio, type ItemTreino } from '@/lib/treinos-prontos'
import { opcoesDeTroca } from '@/lib/treinos-prontos/trocas'
import { lerSeriesFeitas, lerTrocas, marcarFeito, salvarSeriesFeitas, salvarTrocas } from '../progresso-local'
import CartaoExercicio from './CartaoExercicio'

type Item = ItemTreino & Exercicio
type Descanso = { indice: number; restante: number }

export default function ExecucaoPronta({ slug, titulo, itens: originais }: { slug: string; titulo: string; itens: Item[] }) {
  const [feitas, setFeitas] = useState<Record<number, number>>({})
  const [trocas, setTrocas] = useState<Record<number, string>>({})
  const itens: Item[] = originais.map((item, i) => {
    const troca = trocas[i]
    return troca && EXERCICIOS[troca] ? { ...item, exercicio: troca, ...EXERCICIOS[troca] } : item
  })
  const [descanso, setDescanso] = useState<Descanso | null>(null)
  const [concluido, setConcluido] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeitas(lerSeriesFeitas(slug))
    setTrocas(lerTrocas(slug))
  }, [slug])

  useEffect(() => {
    if (!descanso) {
      audioRef.current?.pause()
      return
    }
    audioRef.current?.play().catch(() => {})
    const timeout = setTimeout(() => {
      setDescanso((atual) => (!atual || atual.restante <= 1 ? null : { ...atual, restante: atual.restante - 1 }))
    }, 1000)
    return () => clearTimeout(timeout)
  }, [descanso])

  const totalSeries = itens.reduce((total, item) => total + item.series, 0)
  const seriesFeitas = itens.reduce((total, item, i) => total + Math.min(feitas[i] ?? 0, item.series), 0)

  function trocar(indice: number, exercicio: string | null) {
    const proximas = { ...trocas }
    if (exercicio && exercicio !== originais[indice].exercicio) proximas[indice] = exercicio
    else delete proximas[indice]
    setTrocas(proximas)
    salvarTrocas(slug, proximas)
    const zeradas = { ...feitas, [indice]: 0 }
    setFeitas(zeradas)
    salvarSeriesFeitas(slug, zeradas)
  }

  function concluir() {
    marcarFeito(slug)
    setDescanso(null)
    setConcluido(true)
  }

  function alternarSerie(indice: number, serie: number) {
    const item = itens[indice]
    const atual = feitas[indice] ?? 0
    const nova = serie < atual ? serie : serie + 1
    const proximas = { ...feitas, [indice]: nova }
    setFeitas(proximas)
    salvarSeriesFeitas(slug, proximas)

    if (nova <= atual) return
    const tudoFeito = itens.every((it, i) => (proximas[i] ?? 0) >= it.series)
    if (tudoFeito) {
      concluir()
      return
    }
    setDescanso(nova < item.series && item.descansoSegundos > 0 ? { indice, restante: item.descansoSegundos } : null)
  }

  if (concluido) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Confetti />
        <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">Treino concluído</p>
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Parabéns!</h1>
        <p className="max-w-sm text-sm text-foreground/70">{titulo}</p>
        <Link
          href="/"
          className="mt-4 flex min-h-11 w-full max-w-xs items-center justify-center rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
        >
          Voltar pros treinos
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl bg-background px-4 pb-32 pt-6 text-foreground sm:px-8">
      <audio ref={audioRef} src="/silence.wav" loop preload="auto" className="hidden" />

      <Link href="/" className="text-xs text-foreground/60 underline underline-offset-4">
        ← Treinos
      </Link>
      <h1 className="mt-2 break-words font-display text-3xl uppercase leading-tight">{titulo}</h1>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${totalSeries ? (seriesFeitas / totalSeries) * 100 : 0}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-foreground/60">
        {seriesFeitas} de {totalSeries} séries
      </p>

      <ol className="mt-6 space-y-4">
        {itens.map((item, indice) => (
          <CartaoExercicio
            key={indice}
            item={item}
            feitas={feitas[indice] ?? 0}
            parceiro={item.combinado ? itens.find((o, j) => j !== indice && o.combinado === item.combinado)?.nome : undefined}
            onSerie={(serie) => alternarSerie(indice, serie)}
            opcoes={opcoesDeTroca(item.exercicio, itens.map((o) => o.exercicio))}
            trocado={Boolean(trocas[indice])}
            onTrocar={(exercicio) => trocar(indice, exercicio)}
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={concluir}
        className="mt-8 min-h-11 w-full rounded-full border border-border-subtle py-3 text-sm font-semibold uppercase tracking-wide"
      >
        Concluir treino
      </button>

      {descanso && (
        <div className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-foreground px-5 py-4 text-background shadow-xl">
          <div>
            <p className="text-xs uppercase tracking-widest text-background/60">Descanso</p>
            <p className="font-display text-3xl">{descanso.restante}s</p>
          </div>
          <button
            type="button"
            onClick={() => setDescanso(null)}
            className="min-h-11 rounded-full bg-brand px-5 text-xs font-semibold uppercase tracking-wide text-black"
          >
            Pular
          </button>
        </div>
      )}
    </main>
  )
}
