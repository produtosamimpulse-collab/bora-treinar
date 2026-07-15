'use client'

import { useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function AjudaPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Oi! Sou seu personal trainer virtual. Pode me perguntar sobre qualquer exercício, série ou orientação do seu plano atual.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem')
      }

      const result = await response.json()
      setMessages((current) => [...current, { role: 'assistant', content: result.content }])
    } catch {
      setError('Algo deu errado. Tente enviar de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col bg-background px-6 py-6 text-foreground">
      <header className="mb-4">
        <a
          href="/plano"
          className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          ← Voltar pro plano
        </a>
        <h1 className="mt-2 font-display text-2xl uppercase leading-none tracking-tight sm:text-3xl">
          Fala com o <span className="text-brand text-outline">treinador</span>
        </h1>
      </header>

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
          className="min-h-11 flex-1 rounded-xl border border-border-subtle bg-surface p-3 text-sm focus:border-brand focus:outline-none"
          placeholder="Digite sua pergunta"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="min-h-11 rounded-xl bg-brand px-5 py-3 text-sm font-semibold uppercase text-black disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  )
}
