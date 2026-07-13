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

  async function markComplete(dayId: string) {
    // A API deriva o usuário da sessão (getAuthenticatedUserId); não
    // enviamos userId daqui, o cliente não deve ser responsável por isso.
    await fetch('/api/workout-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutDayId: dayId }),
    })
    setCompletedDayIds((current) => new Set(current).add(dayId))
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
                  {day.exercises.map((exercise) => (
                    <li key={exercise.id} className="flex items-center gap-4">
                      <img
                        src={`/api/exercises/${exercise.exerciseId}/gif`}
                        alt={exercise.name}
                        className="h-16 w-16 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{exercise.name}</p>
                        <p className="text-xs text-foreground/60">
                          {exercise.targetSets}x{exercise.targetReps}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => markComplete(day.id)}
                  disabled={isCompleted}
                  className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold uppercase tracking-wide text-black disabled:opacity-50"
                >
                  {isCompleted ? 'Treino concluído' : 'Marcar como concluído'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
