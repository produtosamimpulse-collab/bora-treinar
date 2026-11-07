import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { ORDEM_LAIS, ORDEM_POR_PARTE, agruparTreinos, resumoDoTreino } from '@/lib/treinos-prontos'
import ListaTreinos from './ListaTreinos'

function blocos(colecao: 'parte' | 'lais', ordem: string[]) {
  return agruparTreinos(colecao, ordem).map((bloco) => ({
    grupo: bloco.grupo,
    treinos: bloco.treinos.map((t) => ({ slug: t.slug, nome: t.nome, resumo: resumoDoTreino(t) })),
  }))
}

export default async function Home() {
  const userId = await getAuthenticatedUserId()
  let hasPlan = false

  if (userId) {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('training_plan')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    hasPlan = data != null
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 bg-background px-4 pb-12 pt-8 text-foreground sm:px-8">
      <header className="mb-6">
        <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-6xl">
          Bora <span className="text-brand text-outline">Treinar!</span>
        </h1>
      </header>

      <ListaTreinos porParte={blocos('parte', ORDEM_POR_PARTE)} lais={blocos('lais', ORDEM_LAIS)} />

      <Link
        href={hasPlan ? '/plano' : '/onboarding'}
        prefetch={false}
        className="mt-10 flex min-h-11 items-center justify-between rounded-2xl border border-border-subtle px-4 py-3 text-sm font-medium text-foreground/70"
      >
        {hasPlan ? 'Meu plano montado pela IA' : 'Montar um plano com a IA'}
        <span aria-hidden>→</span>
      </Link>
    </main>
  )
}
