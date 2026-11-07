'use client'

import { useState } from 'react'
import { EXERCICIOS, ehTempo, type Exercicio, type ItemTreino } from '@/lib/treinos-prontos'
import { POSICIONAMENTO } from '@/lib/treinos-prontos/posicionamento'

type Props = {
  item: ItemTreino & Exercicio
  feitas: number
  parceiro?: string
  onSerie: (serie: number) => void
  opcoes: string[]
  trocado: boolean
  onTrocar: (exercicio: string | null) => void
}

function prescricao(item: ItemTreino): string {
  const reps = ehTempo(item.repeticoes) ? item.repeticoes : `${item.repeticoes} reps`
  const partes = [item.series > 1 ? `${item.series} x ${reps}` : reps]
  if (item.carga && item.carga !== 'corpo') partes.push(item.carga)
  if (item.descansoSegundos > 0) partes.push(`descanso ${item.descansoSegundos}s`)
  return partes.join(' · ')
}

export default function CartaoExercicio({ item, feitas, parceiro, onSerie, opcoes, trocado, onTrocar }: Props) {
  const [ampliado, setAmpliado] = useState(false)
  const [trocando, setTrocando] = useState(false)
  const pronto = feitas >= item.series
  const posicao = POSICIONAMENTO[item.exercicio]

  return (
    <li className={`rounded-2xl border border-border-subtle bg-surface p-4 ${pronto ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {item.midia ? (
          <button type="button" onClick={() => setAmpliado((v) => !v)} className="shrink-0" aria-label="Ampliar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.midia}
              alt={item.nome}
              loading="lazy"
              className="h-20 w-20 rounded-xl bg-white object-cover"
            />
          </button>
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-xl bg-white" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{item.nome}</p>
          <p className="mt-0.5 text-xs text-foreground/60">{prescricao(item)}</p>
          {posicao && (
            <p className="mt-1.5 text-xs leading-snug text-foreground/80">
              <span className="font-semibold">{posicao.rotulo}: </span>
              {posicao.texto}
            </p>
          )}
          {item.observacao && <p className="mt-1 text-xs font-medium">{item.observacao}</p>}
          {parceiro && <p className="mt-1 text-xs font-medium">Alterne com {parceiro}</p>}
        </div>
        {pronto ? (
          <span aria-hidden className="text-2xl text-brand text-outline">
            ✓
          </span>
        ) : (
          (opcoes.length > 0 || trocado) && (
            <button
              type="button"
              onClick={() => setTrocando((v) => !v)}
              className="min-h-11 shrink-0 rounded-full border border-border-subtle bg-background px-3 text-xs font-semibold uppercase tracking-wide text-foreground/70"
            >
              {trocando ? 'Fechar' : 'Trocar'}
            </button>
          )
        )}
      </div>

      {trocando && (
        <ul className="mt-3 space-y-2">
          {trocado && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onTrocar(null)
                  setTrocando(false)
                }}
                className="flex min-h-11 w-full items-center rounded-xl border border-black bg-brand px-3 text-left text-sm font-semibold text-black"
              >
                Voltar ao exercício original
              </button>
            </li>
          )}
          {opcoes.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => {
                  onTrocar(slug)
                  setTrocando(false)
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border-subtle bg-background p-2 text-left text-sm"
              >
                {EXERCICIOS[slug].midia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={EXERCICIOS[slug].midia!} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg bg-white object-cover" />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded-lg bg-white" />
                )}
                {EXERCICIOS[slug].nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      {ampliado && item.midia && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.midia} alt={item.nome} className="mt-3 w-full rounded-xl bg-white object-contain" />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: item.series }, (_, serie) => {
          const feita = serie < feitas
          return (
            <button
              key={serie}
              type="button"
              onClick={() => onSerie(serie)}
              aria-label={`Série ${serie + 1}`}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border text-sm font-bold ${
                feita ? 'border-black bg-brand text-black' : 'border-border-subtle bg-background text-foreground/60'
              }`}
            >
              {feita ? '✓' : serie + 1}
            </button>
          )
        })}
      </div>
    </li>
  )
}
