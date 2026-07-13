'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const supabase = createBrowserSupabaseClient()

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      if (data.session) {
        router.push('/')
        router.refresh()
        return
      }

      setInfo('Conta criada! Verifique seu email para confirmar antes de entrar.')
      setMode('signin')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  function toggleMode() {
    setError(null)
    setInfo(null)
    setMode((current) => (current === 'signin' ? 'signup' : 'signin'))
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
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </span>
        <h1 className="font-display text-3xl uppercase leading-none tracking-tight">
          Bora <span className="text-brand">Treinar!</span>
        </h1>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-background p-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-brand focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-background p-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-brand focus:outline-none"
            minLength={6}
            required
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {info && <p className="mt-3 text-sm text-green-700">{info}</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
        >
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className="mt-4 w-full text-center text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          {mode === 'signin' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </main>
  )
}
