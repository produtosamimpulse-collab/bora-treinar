'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Message = { role: 'user' | 'assistant'; content: string }

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Oi! Vamos montar seu plano. Qual seu objetivo principal com o treino?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function sendMessage() {
    if (!input.trim()) {
      return
    }

    const nextMessages: Message[] = [...messages, { role: 'user', content: input }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem')
      }

      const result = await response.json()

      if (result.type === 'completed') {
        router.push(`/plano?id=${result.trainingPlanId}`)
        return
      }

      setMessages((current) => [...current, { role: 'assistant', content: result.content }])
    } catch {
      setError('Algo deu errado. Tente enviar de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-background px-6 py-10 text-foreground">
      <h1 className="mb-6 font-display text-3xl uppercase leading-none tracking-tight">
        Vamos <span className="text-brand">te conhecer</span>
      </h1>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-2xl bg-brand px-4 py-2 text-sm text-black'
                : 'mr-auto max-w-[80%] rounded-2xl border border-border-subtle bg-surface px-4 py-2 text-sm'
            }
          >
            {message.content}
          </div>
        ))}
        {loading && <p className="text-sm text-foreground/50">Digitando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 rounded-xl border border-border-subtle bg-surface p-3 text-sm focus:border-brand focus:outline-none"
          placeholder="Digite sua resposta"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-brand px-5 text-sm font-semibold uppercase text-black disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  )
}
