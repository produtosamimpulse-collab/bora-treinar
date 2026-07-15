'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Confetti from '@/app/components/Confetti'

type Message = { role: 'user' | 'assistant'; content: string }

export default function CheckinChat({
  trainingPlanId,
  monthNumber,
}: {
  trainingPlanId: string
  monthNumber: number
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Parabéns por fechar o mês ${monthNumber}! Antes de eu montar o próximo mês, me conta: qual seu peso atual, como você está se sentindo (motivação e cansaço) e se sentiu alguma dor. Se quiser, também pode me passar suas medidas.`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [newTrainingPlanId, setNewTrainingPlanId] = useState<string | null>(null)

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
      const response = await fetch('/api/checkin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, trainingPlanId }),
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem')
      }

      const result = (await response.json()) as {
        content: string
        completed: boolean
        trainingPlanId: string | null
      }

      setMessages((current) => [...current, { role: 'assistant', content: result.content }])

      if (result.completed && result.trainingPlanId) {
        setCompleted(true)
        setNewTrainingPlanId(result.trainingPlanId)
      }
    } catch {
      setError('Algo deu errado. Tente enviar de novo.')
    } finally {
      setLoading(false)
    }
  }

  if (completed && newTrainingPlanId) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Confetti />
        <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
          Avaliação registrada
        </p>
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Mês novo, vamos lá!</h1>
        <p className="max-w-sm text-sm text-foreground/70">
          Já usei o que você me contou pra planejar o próximo mês.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/plano?id=${newTrainingPlanId}`)}
          className="mt-4 min-h-11 w-full max-w-xs rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
        >
          Ver novo plano
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col bg-background px-6 py-10 text-foreground">
      <h1 className="mb-6 font-display text-3xl uppercase leading-none tracking-tight">
        Avaliação <span className="text-brand text-outline">mensal</span>
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
          className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold uppercase text-black disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  )
}
