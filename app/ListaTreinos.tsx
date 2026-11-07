'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { lerUltimoFeito } from '@/app/treinos/progresso-local'

type CartaoTreino = { slug: string; nome: string; resumo: string }
type Bloco = { grupo: string; treinos: CartaoTreino[] }

const ABAS = [
  { id: 'parte', rotulo: 'Por parte do corpo' },
  { id: 'lais', rotulo: 'Treinos da Laís' },
] as const

type Aba = (typeof ABAS)[number]['id']

export default function ListaTreinos({ porParte, lais }: { porParte: Bloco[]; lais: Bloco[] }) {
  const [aba, setAba] = useState<Aba>('parte')
  const [feitos, setFeitos] = useState<Record<string, string>>({})

  useEffect(() => {
    const todos = [...porParte, ...lais].flatMap((bloco) => bloco.treinos)
    const lidos: Record<string, string> = {}
    for (const treino of todos) {
      const data = lerUltimoFeito(treino.slug)
      if (data) lidos[treino.slug] = data
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeitos(lidos)
  }, [porParte, lais])

  const blocos = aba === 'parte' ? porParte : lais

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border-subtle bg-surface p-1">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`min-h-11 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors ${
              aba === item.id ? 'bg-foreground text-background' : 'text-foreground/60'
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {blocos.map((bloco) => (
          <section key={bloco.grupo}>
            <h2 className="mb-3 font-display text-xl uppercase tracking-tight">{bloco.grupo}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {bloco.treinos.map((treino) => (
                <li key={treino.slug}>
                  <Link
                    href={`/treinos/${treino.slug}`}
                    prefetch={false}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 transition-transform active:scale-[0.98]"
                  >
                    <div>
                      <p className="text-sm font-semibold">{treino.nome}</p>
                      <p className="mt-0.5 text-xs text-foreground/60">
                        {treino.resumo}
                        {feitos[treino.slug] ? ` · feito em ${feitos[treino.slug]}` : ''}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-black"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
