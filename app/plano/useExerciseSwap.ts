'use client'

import { useMemo, useState } from 'react'

export type SwappableExercise = { id: string; exerciseId: string; name: string }

// Gerencia a lista de exercícios exibida e as trocas em cima dela. A lista
// pode mudar de três jeitos: pelo botão "Trocar", pelo chat trocando um
// exercício, ou pelo chat refazendo o treino do dia inteiro (`replaceAll`).
export function useExerciseSwap<T extends SwappableExercise>(initialExercises: T[]) {
  const [exercises, setExercises] = useState<T[]>(initialExercises)

  const exerciseNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const exercise of exercises) map[exercise.id] = exercise.name
    return map
  }, [exercises])

  const exerciseIds = useMemo(() => {
    const map: Record<string, string> = {}
    for (const exercise of exercises) map[exercise.id] = exercise.exerciseId
    return map
  }, [exercises])

  const [loadingOptionsFor, setLoadingOptionsFor] = useState<string | null>(null)
  const [swapOptionsFor, setSwapOptionsFor] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<{ id: string; name: string }[]>([])
  const [applyingOptionId, setApplyingOptionId] = useState<string | null>(null)

  function applySwapResult(workoutDayExerciseId: string, exercise: { id: string; name: string }) {
    setExercises((current) =>
      current.map((item) =>
        item.id === workoutDayExerciseId
          ? { ...item, exerciseId: exercise.id, name: exercise.name }
          : item
      )
    )
  }

  // Usado quando o treinador refaz o treino do dia inteiro: a lista antiga
  // deixa de existir (as linhas são recriadas no banco, com IDs novos).
  function replaceAll(newExercises: T[]) {
    setExercises(newExercises)
    setSwapOptionsFor(null)
    setSwapOptions([])
  }

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
      applySwapResult(workoutDayExerciseId, {
        id: newExercise.id,
        name: newExercise.name_pt ?? newExercise.name,
      })
      setSwapOptionsFor(null)
    } finally {
      setApplyingOptionId(null)
    }
  }

  return {
    exercises,
    replaceAll,
    exerciseNames,
    exerciseIds,
    loadingOptionsFor,
    swapOptionsFor,
    swapOptions,
    applyingOptionId,
    openSwapOptions,
    chooseSwapOption,
    applySwapResult,
  }
}
