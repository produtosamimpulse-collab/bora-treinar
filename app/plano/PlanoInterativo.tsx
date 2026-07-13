'use client'

import { useState } from 'react'

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
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null)
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(
    new Set(initialCompletedDayIds)
  )
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
  const [checkedExerciseIds, setCheckedExerciseIds] = useState<Set<string>>(new Set())
  const [swapping, setSwapping] = useState<string | null>(null)

  async function completeDay(dayId: string) {
    await fetch('/api/workout-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutDayId: dayId }),
    })
    setCompletedDayIds((current) => new Set(current).add(dayId))
  }

  function toggleExercise(day: DayItem, exerciseItemId: string) {
    setCheckedExerciseIds((current) => {
      const next = new Set(current)
      if (next.has(exerciseItemId)) {
        next.delete(exerciseItemId)
      } else {
        next.add(exerciseItemId)
      }

      const allChecked = day.exercises.every((exercise) => next.has(exercise.id))
      if (allChecked && !completedDayIds.has(day.id)) {
        completeDay(day.id)
      }

      return next
    })
  }

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
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
                  {day.dayOfWeek ? WEEKDAY_NAMES[day.dayOfWeek] : 'Dia'}
                </p>
                <h2 className="font-display text-2xl uppercase">{day.dayLabel}</h2>
              </div>
              <span aria-hidden className="text-2xl text-brand">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle p-6">
                <ul className="space-y-4">
                  {day.exercises.map((exercise) => {
                    const isChecked = checkedExerciseIds.has(exercise.id)

                    return (
                      <li key={exercise.id} className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleExercise(day, exercise.id)}
                          className="h-5 w-5 accent-[var(--brand)]"
                        />
                        <img
                          src={`/api/exercises/${exerciseIds[exercise.id]}/gif`}
                          alt={exerciseNames[exercise.id]}
                          className="h-16 w-16 rounded-lg object-cover"
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
                        <button
                          type="button"
                          onClick={() => swapExercise(exercise.id)}
                          disabled={swapping === exercise.id}
                          className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50"
                        >
                          {swapping === exercise.id ? 'Trocando...' : 'Trocar'}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-6 text-center text-sm text-foreground/60">
                  {isCompleted
                    ? 'Treino concluído.'
                    : 'Marque todos os exercícios para concluir o treino do dia.'}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
