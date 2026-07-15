'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function PlanoInterativo({
  days,
  initialCompletedDayIds = [],
}: {
  days: DayItem[]
  initialCompletedDayIds?: string[]
}) {
  const router = useRouter()
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null)
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const day of days) {
      for (const exercise of day.exercises) {
        initial[exercise.id] = exercise.name
      }
    }
    return initial
  })
  const [exerciseIds, setExerciseIds] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const day of days) {
      for (const exercise of day.exercises) {
        initial[exercise.id] = exercise.exerciseId
      }
    }
    return initial
  })
  const [loadingOptionsFor, setLoadingOptionsFor] = useState<string | null>(null)
  const [swapOptionsFor, setSwapOptionsFor] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<{ id: string; name: string }[]>([])
  const [applyingOptionId, setApplyingOptionId] = useState<string | null>(null)
  const completedDayIds = new Set(initialCompletedDayIds)

  async function openSwapOptions(workoutDayExerciseId: string) {
    if (swapOptionsFor === workoutDayExerciseId) {
      setSwapOptionsFor(null)
      return
    }

    setLoadingOptionsFor(workoutDayExerciseId)

    try {
      const response = await fetch(`/api/workout-day-exercises/${workoutDayExerciseId}/swap-options`)

      if (!response.ok) {
        return
      }

      const options = await response.json()
      setSwapOptions(options)
      setSwapOptionsFor(workoutDayExerciseId)
    } finally {
      setLoadingOptionsFor(null)
    }
  }

  async function chooseSwapOption(workoutDayExerciseId: string, exerciseId: string) {
    setApplyingOptionId(exerciseId)

    try {
      const response = await fetch(`/api/workout-day-exercises/${workoutDayExerciseId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId }),
      })

      if (!response.ok) {
        return
      }

      const newExercise = await response.json()
      setExerciseNames((current) => ({
        ...current,
        [workoutDayExerciseId]: newExercise.name_pt ?? newExercise.name,
      }))
      setExerciseIds((current) => ({
        ...current,
        [workoutDayExerciseId]: newExercise.id,
      }))
      setSwapOptionsFor(null)
    } finally {
      setApplyingOptionId(null)
    }
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const isOpen = openDayId === day.id
        const isCompleted = completedDayIds.has(day.id)

        return (
          <div key={day.id} className="rounded-2xl border border-border-subtle bg-surface">
            <button
              type="button"
              onClick={() => setOpenDayId(isOpen ? null : day.id)}
              className="flex w-full items-center justify-between p-4 text-left sm:p-6"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
                  {day.dayOfWeek ? WEEKDAY_NAMES[day.dayOfWeek] : 'Dia'}
                </p>
                <h2 className="font-display text-xl uppercase sm:text-2xl">{day.dayLabel}</h2>
              </div>
              <span aria-hidden className="text-2xl text-brand text-outline">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle p-4 sm:p-6">
                <ul className="space-y-4">
                  {day.exercises.map((exercise) => (
                    <li key={exercise.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={`/api/exercises/${exerciseIds[exercise.id]}/gif`}
                            alt={exerciseNames[exercise.id]}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                            loading="lazy"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium capitalize">
                              {exerciseNames[exercise.id]}
                            </p>
                            <p className="text-xs text-foreground/60">
                              {exercise.targetSets}x{exercise.targetReps}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openSwapOptions(exercise.id)}
                          disabled={loadingOptionsFor === exercise.id}
                          className="min-h-11 self-start rounded-full border border-border-subtle px-4 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50 sm:self-auto"
                        >
                          {loadingOptionsFor === exercise.id ? 'Carregando...' : 'Trocar'}
                        </button>
                      </div>

                      {swapOptionsFor === exercise.id && (
                        <div className="mt-3 rounded-xl border border-border-subtle bg-background p-3">
                          {swapOptions.length === 0 ? (
                            <p className="text-xs text-foreground/60">
                              Nenhuma alternativa disponível pra esse grupo muscular.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {swapOptions.map((option) => (
                                <li key={option.id}>
                                  <button
                                    type="button"
                                    onClick={() => chooseSwapOption(exercise.id, option.id)}
                                    disabled={applyingOptionId === option.id}
                                    className="min-h-11 w-full rounded-lg border border-border-subtle px-3 text-left text-sm capitalize hover:border-brand disabled:opacity-50"
                                  >
                                    {option.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
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

                {isCompleted ? (
                  <p className="mt-6 text-center text-sm text-foreground/60">Treino concluído.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/plano/treino/${day.id}`)}
                    className="mt-6 w-full rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
                  >
                    Iniciar treino
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
