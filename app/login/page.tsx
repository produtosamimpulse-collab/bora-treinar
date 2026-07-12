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
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-black">Bora Treinar!</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-black"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-black"
          minLength={6}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button
          type="submit"
          className="w-full rounded bg-brand p-2 font-medium text-black"
        >
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className="w-full text-sm text-gray-600 underline"
        >
          {mode === 'signin' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </main>
  )
}
