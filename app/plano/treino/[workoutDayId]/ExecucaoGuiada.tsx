'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Confetti from '@/app/components/Confetti'
import ExerciseSwapPanel from '@/app/components/ExerciseSwapPanel'
import CoachChatPanel from '@/app/components/CoachChatPanel'
import { useExerciseSwap } from '@/app/plano/useExerciseSwap'
import { useCoachChat } from '@/app/plano/useCoachChat'

type Exercise = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetLoadKg: number | null
  targetRir: string | null
  setsDone: number
}

type Draft = { reps: string; load: string; rir: string }

type RestState = { exerciseId: string; secondsLeft: number }

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

  const swap = useExerciseSwap(initialExercises)
  // Aqui a tela guarda séries já registradas, cronômetro de descanso e
  // rascunhos por exercício - se o treinador refizer o dia inteiro no meio
  // da execução, nada disso vale mais, então a tela pede pra recarregar em
  // vez de tentar remendar o estado antigo com exercícios novos.
  const [rebuiltDayLabel, setRebuiltDayLabel] = useState<string | null>(null)
  const chat = useCoachChat(workoutDayId, swap.applySwapResult, (rebuiltDay) =>
    setRebuiltDayLabel(rebuiltDay.dayLabel)
  )
  const [chatOpen, setChatOpen] = useState(false)

  const [currentSetByExercise, setCurrentSetByExercise] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const exercise of initialExercises) initial[exercise.id] = exercise.setsDone + 1
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
  const [completedTrainingPlanId, setCompletedTrainingPlanId] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)

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

    // Some direto pra null no último segundo em vez de passar por um estado
    // intermediário com secondsLeft <= 0 - evita precisar de um setState
    // síncrono no corpo do efeito (dispara uma cascata de renders extra).
    const timeout = setTimeout(() => {
      setResting((current) => {
        if (!current || current.secondsLeft <= 1) {
          return null
        }
        return { ...current, secondsLeft: current.secondsLeft - 1 }
      })
    }, 1000)

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
      const exerciseName = swap.exerciseNames[resting.exerciseId] ?? ''

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Descanso: ${resting.secondsLeft}s`,
        artist: exerciseName,
        album: 'Bora Treinar!',
        artwork: [{ src: '/icon-512.jpg', sizes: '512x512', type: 'image/jpeg' }],
      })
      navigator.mediaSession.playbackState = 'playing'
    }

    audioRef.current?.play().catch(() => {})
  }, [resting, swap.exerciseNames])

  // Se todas as séries já estavam concluídas quando a página carregou (ex: o
  // app fechou antes do finish() rodar da última vez), completa o treino
  // automaticamente em vez de deixar preso numa tela sem próxima ação.
  useEffect(() => {
    const allDoneOnLoad =
      initialExercises.length > 0 &&
      initialExercises.every((exercise) => exercise.setsDone >= exercise.targetSets)

    if (allDoneOnLoad) {
      finishWorkout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finishWorkout() {
    setFinishing(true)
    setFinishError(null)

    try {
      const response = await fetch(`/api/workout-day/${workoutDayId}/finish`, { method: 'POST' })

      if (!response.ok) {
        setFinishError('Os exercícios foram salvos, mas não deu pra concluir o treino. Tente de novo.')
        return
      }

      const body = (await response.json()) as {
        monthCompleted: boolean
        trainingPlanId: string | null
      }

      if (body.monthCompleted) {
        setCompletedTrainingPlanId(body.trainingPlanId)
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
    const currentExerciseId = swap.exerciseIds[exercise.id]

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

  if (monthCompleted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Confetti />
        <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
          Mês concluído
        </p>
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">Parabéns!</h1>
        <p className="max-w-sm text-sm text-foreground/70">
          Você terminou as 4 semanas do mês. Antes de montar o mês seguinte, vamos fazer sua
          avaliação com o personal.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/checkin?planId=${completedTrainingPlanId}`)}
          className="mt-4 min-h-11 w-full max-w-xs rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
        >
          Fazer avaliação mensal
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
          <Link
            href="/plano"
            className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
          >
            ← Voltar pro plano
          </Link>
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
          const name = swap.exerciseNames[exercise.id]

          return (
            <li
              key={exercise.id}
              className={`rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6 ${done ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-4">
                <Image
                  src={`/api/exercises/${swap.exerciseIds[exercise.id]}/gif`}
                  alt={name}
                  width={64}
                  height={64}
                  unoptimized
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
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
                    onClick={() => swap.openSwapOptions(exercise.id)}
                    disabled={swap.loadingOptionsFor === exercise.id}
                    className="min-h-11 shrink-0 rounded-full border border-border-subtle px-3 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50"
                  >
                    {swap.loadingOptionsFor === exercise.id ? '...' : 'Trocar'}
                  </button>
                )}
              </div>

              {swap.swapOptionsFor === exercise.id && (
                <ExerciseSwapPanel
                  options={swap.swapOptions}
                  applyingOptionId={swap.applyingOptionId}
                  onChoose={(exerciseId) => swap.chooseSwapOption(exercise.id, exerciseId)}
                />
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

      {rebuiltDayLabel && (
        <div className="mt-6 rounded-2xl border border-brand/40 bg-surface p-4 text-center">
          <p className="text-sm">
            Treino de hoje refeito: {rebuiltDayLabel}. Recarregue pra começar o treino novo.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 min-h-11 rounded-full bg-brand px-6 text-sm font-semibold uppercase tracking-wide text-black"
          >
            Ver treino novo
          </button>
        </div>
      )}
    </main>
  )
}
