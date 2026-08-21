'use client'

import { useState } from 'react'
import type { CoachMessage } from './useCoachChat'

// Conversa sobre o mês inteiro, não sobre um treino só. Quando o treinador
// refaz algum dia, `onDaysRebuilt` avisa quem estiver usando o hook pra
// recarregar o plano da tela.
export function usePlanChat(trainingPlanId: string, onDaysRebuilt?: (dayIds: string[]) => void) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const trimmed = input.trim()

    if (!trimmed) {
      return
    }

    const nextMessages: CoachMessage[] = [...messages, { role: 'user', content: trimmed }]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/plan-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, trainingPlanId }),
      })

      if (!response.ok) {
        return
      }

      const result = await response.json()

      setMessages([...nextMessages, { role: 'assistant', content: result.content }])

      if (Array.isArray(result.rebuiltDayIds) && result.rebuiltDayIds.length > 0) {
        onDaysRebuilt?.(result.rebuiltDayIds)
      }
    } finally {
      setLoading(false)
    }
  }

  return { messages, input, setInput, loading, send }
}
