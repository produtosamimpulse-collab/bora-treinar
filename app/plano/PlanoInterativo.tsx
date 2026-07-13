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

type DayItem = {
  id: string
  dayLabel: string
  dayOfWeek: number | null
  exercises: ExerciseItem[]
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
  const [swapping, setSwapping] = useState<string | null>(null)
  const completedDayIds = new Set(initialCompletedDayIds)

  async function swapExercise(workoutDayExerciseId: string) {
    setSwapping(workoutDayExerciseId)

    try {
      const response = await fetch(`/api/workout-day-exercises/${workoutDayExerciseId}/swap`, {
        method: 'POST',
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
    } finally {
      setSwapping(null)
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
              <span aria-hidden className="text-2xl text-brand">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle p-4 sm:p-6">
                <ul className="space-y-4">
                  {day.exercises.map((exercise) => (
                    <li
                      key={exercise.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                    >
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
                        onClick={() => swapExercise(exercise.id)}
                        disabled={swapping === exercise.id}
                        className="self-start rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50 sm:self-auto"
                      >
                        {swapping === exercise.id ? 'Trocando...' : 'Trocar'}
                      </button>
                    </li>
                  ))}
                </ul>

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
