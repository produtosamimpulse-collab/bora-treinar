'use client'

import { useState } from 'react'

export type CoachMessage = { role: 'user' | 'assistant'; content: string }

export type RebuiltDay = {
  dayLabel: string
  exercises: Array<{
    id: string
    exerciseId: string
    name: string
    targetSets: number
    targetReps: number
    targetRir: string | null
  }>
}

// Conversa com o treinador sobre um treino específico. Se a IA decidir trocar
// um exercício durante a conversa, `onSwap` deixa quem estiver usando o hook
// refletir isso no estado de exercícios (nome/id exibido). Se ela refizer o
// treino do dia inteiro, `onRebuild` entrega o dia novo já montado.
export function useCoachChat(
  workoutDayId: string,
  onSwap?: (workoutDayExerciseId: string, exercise: { id: string; name: string }) => void,
  onRebuild?: (day: RebuiltDay) => void
) {
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
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, workoutDayId }),
      })

      if (!response.ok) {
        return
      }

      const result = await response.json()

      setMessages([...nextMessages, { role: 'assistant', content: result.content }])

      if (result.swapped) {
        onSwap?.(result.swapped.workoutDayExerciseId, {
          id: result.swapped.id,
          name: result.swapped.name,
        })
      }

      if (result.rebuilt) {
        onRebuild?.(result.rebuilt as RebuiltDay)
      }
    } finally {
      setLoading(false)
    }
  }

  return { messages, input, setInput, loading, send }
}
