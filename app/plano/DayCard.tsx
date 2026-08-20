'use client'

import { useState } from 'react'
import Image from 'next/image'
import ExerciseSwapPanel from '@/app/components/ExerciseSwapPanel'
import CoachChatPanel from '@/app/components/CoachChatPanel'
import { useExerciseSwap } from './useExerciseSwap'
import { useCoachChat } from './useCoachChat'

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
}

type ExerciseItem = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
}

type CardioItem = {
  name: string
  minutes: number | null
  intensity: string | null
}

type DayItem = {
  id: string
  dayLabel: string
  dayOfWeek: number | null
  exercises: ExerciseItem[]
  cardio: CardioItem | null
}

export default function DayCard({
  day,
  isOpen,
  isCompleted,
  onToggle,
  onStart,
}: {
  day: DayItem
  isOpen: boolean
  isCompleted: boolean
  onToggle: () => void
  onStart: () => void
}) {
  const swap = useExerciseSwap(day.exercises)
  const [dayLabel, setDayLabel] = useState(day.dayLabel)
  const chat = useCoachChat(day.id, swap.applySwapResult, (rebuiltDay) => {
    setDayLabel(rebuiltDay.dayLabel)
    swap.replaceAll(
      rebuiltDay.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
      }))
    )
  })
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left sm:p-6"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
            {day.dayOfWeek ? WEEKDAY_NAMES[day.dayOfWeek] : 'Dia'}
          </p>
          <h2 className="font-display text-xl uppercase sm:text-2xl">{dayLabel}</h2>
        </div>
        <span aria-hidden className="text-2xl text-brand text-outline">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border-subtle p-4 sm:p-6">
          <ul className="space-y-4">
            {swap.exercises.map((exercise) => (
              <li key={exercise.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-4">
                    <Image
                      src={`/api/exercises/${swap.exerciseIds[exercise.id]}/gif`}
                      alt={swap.exerciseNames[exercise.id]}
                      width={64}
                      height={64}
                      unoptimized
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">
                        {swap.exerciseNames[exercise.id]}
                      </p>
                      <p className="text-xs text-foreground/60">
                        {exercise.targetSets}x{exercise.targetReps}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => swap.openSwapOptions(exercise.id)}
                    disabled={swap.loadingOptionsFor === exercise.id}
                    className="min-h-11 self-start rounded-full border border-border-subtle px-4 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50 sm:self-auto"
                  >
                    {swap.loadingOptionsFor === exercise.id ? 'Carregando...' : 'Trocar'}
                  </button>
                </div>

                {swap.swapOptionsFor === exercise.id && (
                  <ExerciseSwapPanel
                    options={swap.swapOptions}
                    applyingOptionId={swap.applyingOptionId}
                    onChoose={(exerciseId) => swap.chooseSwapOption(exercise.id, exerciseId)}
                  />
                )}
              </li>
            ))}
          </ul>

          {day.cardio && (
            <div className="mt-6 rounded-xl border border-border-subtle bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
                Depois do treino
              </p>
              <p className="mt-1 text-sm">
                {day.cardio.minutes}min de {day.cardio.name}
                {day.cardio.intensity ? `, intensidade ${day.cardio.intensity}` : ''}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setChatOpen((current) => !current)}
            className="mt-6 min-h-11 w-full rounded-xl border border-border-subtle px-4 text-left text-sm font-medium text-foreground/80"
          >
            {chatOpen ? 'Fechar conversa' : 'Falar com o treinador ou mudar esse treino'}
          </button>

          {chatOpen && (
            <CoachChatPanel
              messages={chat.messages}
              input={chat.input}
              onInputChange={chat.setInput}
              onSend={chat.send}
              loading={chat.loading}
            />
          )}

          {isCompleted ? (
            <p className="mt-6 text-center text-sm text-foreground/60">Treino concluído.</p>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="mt-6 w-full rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
            >
              Iniciar treino
            </button>
          )}
        </div>
      )}
    </div>
  )
}
