'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DayCard from './DayCard'

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
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const completedDayIds = new Set(initialCompletedDayIds)

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          isOpen={openDayId === day.id}
          isCompleted={completedDayIds.has(day.id)}
          onToggle={() => setOpenDayId(openDayId === day.id ? null : day.id)}
          onStart={() => router.push(`/plano/treino/${day.id}`)}
        />
      ))}
    </div>
  )
}
