'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      return
    }

    setDone(true)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand/25 blur-[110px]"
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-6 shadow-xl shadow-black/5 sm:p-8"
      >
        <span className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Nova senha
        </span>
        <h1 className="font-display text-3xl uppercase leading-none tracking-tight">
          Bora <span className="text-brand">Treinar!</span>
        </h1>

        {done ? (
          <>
            <p className="mt-6 text-sm text-green-700">Senha redefinida com sucesso.</p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
            >
              Ir para o login
            </button>
          </>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              <input
                type="password"
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-background p-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-brand focus:outline-none"
                minLength={6}
                required
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
            >
              Salvar nova senha
            </button>
          </>
        )}
      </form>
    </main>
  )
}
