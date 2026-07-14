'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetLoadKg: number | null
  targetRir: string | null
}

export default function ExecucaoGuiada({
  workoutDayId,
  dayLabel,
  restSeconds,
  exercises,
}: {
  workoutDayId: string
  dayLabel: string
  restSeconds: number
  exercises: Exercise[]
}) {
  const router = useRouter()
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [setNumber, setSetNumber] = useState(1)
  const [reps, setReps] = useState('')
  const [load, setLoad] = useState('')
  const [rir, setRir] = useState('')
  const [resting, setResting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(restSeconds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthCompleted, setMonthCompleted] = useState(false)

  const currentExercise = exercises[exerciseIndex]
  const isLastSetOfExercise = currentExercise ? setNumber >= currentExercise.targetSets : false
  const isLastExercise = exerciseIndex >= exercises.length - 1

  useEffect(() => {
    if (!resting) {
      return
    }

    if (secondsLeft <= 0) {
      setResting(false)
      return
    }

    const timeout = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timeout)
  }, [resting, secondsLeft])

  async function saveSet() {
    if (!currentExercise) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const logResponse = await fetch(`/api/workout-day/${workoutDayId}/log-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: currentExercise.exerciseId,
          setNumber,
          repsDone: Number(reps) || 0,
          loadKg: load ? Number(load) : null,
          rirLogged: rir ? Number(rir) : null,
        }),
      })

      if (!logResponse.ok) {
        setError('Não deu pra salvar essa série. Confira sua conexão e tente de novo.')
        return
      }

      setReps('')
      setLoad('')
      setRir('')

      if (isLastSetOfExercise && isLastExercise) {
        const finishResponse = await fetch(`/api/workout-day/${workoutDayId}/finish`, {
          method: 'POST',
        })

        if (!finishResponse.ok) {
          setError('A série foi salva, mas não deu pra concluir o treino. Tente de novo.')
          return
        }

        const finishBody = (await finishResponse.json()) as { monthCompleted: boolean }

        if (finishBody.monthCompleted) {
          setMonthCompleted(true)
          return
        }

        router.push('/plano')
        return
      }

      if (isLastSetOfExercise) {
        setExerciseIndex((i) => i + 1)
        setSetNumber(1)
      } else {
        setSetNumber((s) => s + 1)
        setResting(true)
        setSecondsLeft(restSeconds)
      }
    } catch {
      setError('Não deu pra salvar essa série. Confira sua conexão e tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  if (monthCompleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Mês concluído</p>
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Parabéns!</h1>
        <p className="max-w-sm text-sm text-foreground/70">
          Você terminou as 4 semanas do mês. Já preparei o mês seguinte, começando com uma semana
          de recuperação.
        </p>
        <button
          type="button"
          onClick={() => router.push('/plano')}
          className="mt-4 min-h-11 w-full max-w-xs rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
        >
          Ver novo plano
        </button>
      </main>
    )
  }

  if (!currentExercise) {
    return (
      <main className="min-h-dvh bg-background p-6 text-foreground">
        <p>Nenhum exercício neste treino.</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 py-6 text-foreground sm:px-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
          {dayLabel}
        </p>
        <h1 className="break-words font-display text-2xl uppercase leading-tight sm:text-3xl">
          {currentExercise.name}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Exercício {exerciseIndex + 1} de {exercises.length}, série {setNumber} de{' '}
          {currentExercise.targetSets}
        </p>
        {currentExercise.targetRir && (
          <p className="mt-1 text-xs uppercase tracking-widest text-brand">
            RIR alvo: {currentExercise.targetRir}
          </p>
        )}
      </header>

      {resting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm uppercase tracking-widest text-foreground/60">Descanso</p>
          <p className="font-display text-6xl text-brand">{secondsLeft}s</p>
          <button
            type="button"
            onClick={() => setResting(false)}
            className="min-h-11 rounded-full border border-border-subtle px-6 py-3 text-sm font-semibold uppercase"
          >
            Pular descanso
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-foreground/60">
              Repetições feitas
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder={String(currentExercise.targetReps)}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface p-4 text-lg"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-foreground/60">
              Carga (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={load}
              onChange={(e) => setLoad(e.target.value)}
              placeholder={
                currentExercise.targetLoadKg ? String(currentExercise.targetLoadKg) : 'Livre'
              }
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface p-4 text-lg"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-foreground/60">
              RIR (repetições que ainda daria)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              placeholder={currentExercise.targetRir ?? 'Opcional'}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface p-4 text-lg"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={saveSet}
            disabled={saving}
            className="mt-4 min-h-11 w-full rounded-full bg-brand py-4 text-base font-semibold uppercase tracking-wide text-black disabled:opacity-50"
          >
            {saving ? 'Salvando...' : isLastSetOfExercise && isLastExercise ? 'Concluir treino' : 'Concluir série'}
          </button>
        </div>
      )}
    </main>
  )
}
