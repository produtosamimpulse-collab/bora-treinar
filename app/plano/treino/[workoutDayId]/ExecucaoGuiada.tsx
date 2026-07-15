'use client'

import { useEffect, useRef, useState } from 'react'
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

type Draft = { reps: string; load: string; rir: string }

type RestState = { exerciseId: string; secondsLeft: number }

const CONFETTI_PIECES = ['🎉', '🎊', '✨', '🎆', '🎇']

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece text-2xl"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 1.2}s`,
            animationDuration: `${2 + Math.random() * 1.5}s`,
          }}
        >
          {CONFETTI_PIECES[index % CONFETTI_PIECES.length]}
        </span>
      ))}
    </div>
  )
}

export default function ExecucaoGuiada({
  workoutDayId,
  dayLabel,
  restSeconds,
  exercises: initialExercises,
}: {
  workoutDayId: string
  dayLabel: string
  restSeconds: number
  exercises: Exercise[]
}) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const exercise of initialExercises) initial[exercise.id] = exercise.name
    return initial
  })
  const [exerciseIds, setExerciseIds] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const exercise of initialExercises) initial[exercise.id] = exercise.exerciseId
    return initial
  })
  const [currentSetByExercise, setCurrentSetByExercise] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const exercise of initialExercises) initial[exercise.id] = 1
    return initial
  })
  const [inputs, setInputs] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {}
    for (const exercise of initialExercises) initial[exercise.id] = { reps: '', load: '', rir: '' }
    return initial
  })
  const [errorByExercise, setErrorByExercise] = useState<Record<string, string | null>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [resting, setResting] = useState<RestState | null>(null)
  const [dayCompleted, setDayCompleted] = useState(false)
  const [monthCompleted, setMonthCompleted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [loadingOptionsFor, setLoadingOptionsFor] = useState<string | null>(null)
  const [swapOptionsFor, setSwapOptionsFor] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<{ id: string; name: string }[]>([])
  const [applyingOptionId, setApplyingOptionId] = useState<string | null>(null)

  function updateDraft(exerciseId: string, field: keyof Draft, value: string) {
    setInputs((current) => ({
      ...current,
      [exerciseId]: { ...current[exerciseId], [field]: value },
    }))
  }

  useEffect(() => {
    if (!resting) {
      return
    }

    if (resting.secondsLeft <= 0) {
      setResting(null)
      return
    }

    const timeout = setTimeout(
      () => setResting((current) => (current ? { ...current, secondsLeft: current.secondsLeft - 1 } : null)),
      1000
    )
    return () => clearTimeout(timeout)
  }, [resting])

  // Registra os controles do "mini player" uma vez só - assim, apertar
  // pausar/parar na tela de bloqueio encerra o descanso em vez de travar.
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    const stopResting = () => setResting(null)

    try {
      navigator.mediaSession.setActionHandler('pause', stopResting)
      navigator.mediaSession.setActionHandler('stop', stopResting)
      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play().catch(() => {})
      })
    } catch {
      // nem todo navegador suporta todas as ações
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('stop', null)
        navigator.mediaSession.setActionHandler('play', null)
      } catch {
        // ignora
      }
    }
  }, [])

  // Toca um áudio silencioso em loop enquanto descansa - é o que faz o
  // sistema mostrar um "mini player" persistente na tela de bloqueio/barra
  // de notificações, mesmo com o app em segundo plano. A metadata (título,
  // artista e capa) é atualizada no MESMO efeito que dá o play, pra
  // garantir que o sistema pegue o texto certo desde o primeiro segundo -
  // sem a capa (artwork), alguns navegadores mostram só um player genérico
  // sem título nenhum.
  useEffect(() => {
    if (!resting) {
      audioRef.current?.pause()
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none'
        navigator.mediaSession.metadata = null
      }
      return
    }

    if ('mediaSession' in navigator) {
      const exerciseName = exerciseNames[resting.exerciseId] ?? ''

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Descanso: ${resting.secondsLeft}s`,
        artist: exerciseName,
        album: 'Bora Treinar!',
        artwork: [{ src: '/artwork.png', sizes: '512x512', type: 'image/png' }],
      })
      navigator.mediaSession.playbackState = 'playing'
    }

    audioRef.current?.play().catch(() => {})
  }, [resting, exerciseNames])

  async function finishWorkout() {
    setFinishing(true)
    setFinishError(null)

    try {
      const response = await fetch(`/api/workout-day/${workoutDayId}/finish`, { method: 'POST' })

      if (!response.ok) {
        setFinishError('Os exercícios foram salvos, mas não deu pra concluir o treino. Tente de novo.')
        return
      }

      const body = (await response.json()) as { monthCompleted: boolean }

      if (body.monthCompleted) {
        setMonthCompleted(true)
      } else {
        setDayCompleted(true)
      }
    } catch {
      setFinishError('Os exercícios foram salvos, mas não deu pra concluir o treino. Tente de novo.')
    } finally {
      setFinishing(false)
    }
  }

  async function logSet(exercise: Exercise) {
    const setNumber = currentSetByExercise[exercise.id]
    const draft = inputs[exercise.id]
    const currentExerciseId = exerciseIds[exercise.id]

    setSavingId(exercise.id)
    setErrorByExercise((current) => ({ ...current, [exercise.id]: null }))

    try {
      const response = await fetch(`/api/workout-day/${workoutDayId}/log-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: currentExerciseId,
          setNumber,
          repsDone: Number(draft.reps) || 0,
          loadKg: draft.load ? Number(draft.load) : null,
          rirLogged: draft.rir ? Number(draft.rir) : null,
        }),
      })

      if (!response.ok) {
        setErrorByExercise((current) => ({
          ...current,
          [exercise.id]: 'Não deu pra salvar essa série. Tente de novo.',
        }))
        return
      }

      const nextSet = setNumber + 1

      setCurrentSetByExercise((current) => ({ ...current, [exercise.id]: nextSet }))
      setInputs((current) => ({ ...current, [exercise.id]: { reps: '', load: '', rir: '' } }))

      if (nextSet <= exercise.targetSets) {
        setResting({ exerciseId: exercise.id, secondsLeft: restSeconds })
      }

      const allDone = initialExercises.every((e) => {
        const nextForThis = e.id === exercise.id ? nextSet : currentSetByExercise[e.id]
        return nextForThis > e.targetSets
      })

      if (allDone) {
        await finishWorkout()
      }
    } catch {
      setErrorByExercise((current) => ({
        ...current,
        [exercise.id]: 'Não deu pra salvar essa série. Tente de novo.',
      }))
    } finally {
      setSavingId(null)
    }
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

  if (monthCompleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Confetti />
        <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
          Mês concluído
        </p>
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

  if (dayCompleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Confetti />
        <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
          Treino concluído
        </p>
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Parabéns!</h1>
        <p className="max-w-sm text-sm text-foreground/70">Você terminou o treino de hoje.</p>
        <button
          type="button"
          onClick={() => router.push('/plano')}
          className="mt-4 min-h-11 w-full max-w-xs rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
        >
          Voltar pro plano
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-10">
      <audio ref={audioRef} src="/silence.wav" loop preload="auto" className="hidden" />

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <a
            href="/plano"
            className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
          >
            ← Voltar pro plano
          </a>
          <h1 className="mt-2 break-words font-display text-2xl uppercase leading-tight sm:text-3xl">
            {dayLabel}
          </h1>
        </div>
      </header>

      {finishing && <p className="mb-4 text-sm text-foreground/60">Concluindo treino...</p>}
      {finishError && (
        <div className="mb-4 rounded-xl border border-red-600/40 bg-red-600/10 p-4">
          <p className="text-sm text-red-600">{finishError}</p>
          <button
            type="button"
            onClick={finishWorkout}
            className="mt-2 min-h-11 rounded-full border border-red-600/40 px-4 text-xs font-semibold uppercase text-red-600"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {initialExercises.length === 0 && (
        <p className="text-sm text-foreground/60">Nenhum exercício neste treino.</p>
      )}

      <ul className="space-y-4">
        {initialExercises.map((exercise) => {
          const currentSet = currentSetByExercise[exercise.id]
          const done = currentSet > exercise.targetSets
          const draft = inputs[exercise.id]
          const isSaving = savingId === exercise.id
          const isResting = resting?.exerciseId === exercise.id
          const name = exerciseNames[exercise.id]

          return (
            <li
              key={exercise.id}
              className={`rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6 ${done ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={`/api/exercises/${exerciseIds[exercise.id]}/gif`}
                  alt={name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{name}</p>
                  <p className="text-xs text-foreground/60">
                    {done
                      ? `${exercise.targetSets} séries concluídas`
                      : `Série ${currentSet} de ${exercise.targetSets} · ${exercise.targetReps} reps`}
                    {exercise.targetRir && !done ? ` · RIR ${exercise.targetRir}` : ''}
                  </p>
                </div>
                {done ? (
                  <span aria-hidden className="text-2xl text-brand text-outline">
                    ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSwapOptions(exercise.id)}
                    disabled={loadingOptionsFor === exercise.id}
                    className="min-h-11 shrink-0 rounded-full border border-border-subtle px-3 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50"
                  >
                    {loadingOptionsFor === exercise.id ? '...' : 'Trocar'}
                  </button>
                )}
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

              {!done && (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="w-20">
                    <label className="mb-1 block text-xs uppercase tracking-widest text-foreground/60">
                      Reps
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft.reps}
                      onChange={(e) => updateDraft(exercise.id, 'reps', e.target.value)}
                      placeholder={String(exercise.targetReps)}
                      className="min-h-11 w-full rounded-xl border border-border-subtle bg-background p-2 text-center text-base"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-xs uppercase tracking-widest text-foreground/60">
                      Peso
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={draft.load}
                      onChange={(e) => updateDraft(exercise.id, 'load', e.target.value)}
                      placeholder={exercise.targetLoadKg ? String(exercise.targetLoadKg) : 'kg'}
                      className="min-h-11 w-full rounded-xl border border-border-subtle bg-background p-2 text-center text-base"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-xs uppercase tracking-widest text-foreground/60">
                      RIR
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft.rir}
                      onChange={(e) => updateDraft(exercise.id, 'rir', e.target.value)}
                      placeholder={exercise.targetRir ?? '-'}
                      className="min-h-11 w-full rounded-xl border border-border-subtle bg-background p-2 text-center text-base"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => logSet(exercise)}
                    disabled={isSaving}
                    aria-label="Marcar série como feita"
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand text-xl font-bold text-black disabled:opacity-50"
                  >
                    {isSaving ? '...' : '✓'}
                  </button>
                </div>
              )}

              {isResting && (
                <p className="mt-3 text-xs uppercase tracking-widest text-brand text-outline">
                  Descanso: {resting.secondsLeft}s
                </p>
              )}

              {errorByExercise[exercise.id] && (
                <p className="mt-3 text-sm text-red-600">{errorByExercise[exercise.id]}</p>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
