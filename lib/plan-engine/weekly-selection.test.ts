import { describe, it, expect } from 'vitest'
import { planWeekExercises, type CandidateExercise } from './weekly-selection'

function exercise(id: string, target: string, mechanic: 'composto' | 'isolado', secondaryMuscles: string[] = []): CandidateExercise {
  return { id, name: `Exercise ${id}`, target, mechanic, secondaryMuscles }
}

describe('planWeekExercises', () => {
  it('does not repeat the same exercise across different days in the same week when enough alternatives exist', () => {
    const candidatesByDay = [
      [exercise('a', 'pectorals', 'composto'), exercise('b', 'pectorals', 'composto'), exercise('c', 'pectorals', 'composto')],
      [
        exercise('a', 'pectorals', 'composto'),
        exercise('b', 'pectorals', 'composto'),
        exercise('e', 'pectorals', 'composto'),
        exercise('f', 'pectorals', 'composto'),
      ],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 2)

    expect(result[0].map((e) => e.id)).toEqual(['a', 'b'])
    expect(result[1].map((e) => e.id)).toEqual(['e', 'f'])
  })

  it('falls back to repeating within the week when there are not enough fresh candidates', () => {
    const candidatesByDay = [
      [exercise('a', 'pectorals', 'composto')],
      [exercise('a', 'pectorals', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 1)

    expect(result[0].map((e) => e.id)).toEqual(['a'])
    expect(result[1].map((e) => e.id)).toEqual(['a'])
  })

  it('orders each day compound-first', () => {
    const candidatesByDay = [
      [exercise('iso-1', 'pectorals', 'isolado'), exercise('comp-1', 'pectorals', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 2)

    expect(result[0].map((e) => e.id)).toEqual(['comp-1', 'iso-1'])
  })

  it('stops adding sets to a target once the weekly max is reached, counting secondary muscles as half a set, preferring an under-volume alternative', () => {
    const candidatesByDay = [
      // dia 1: pectorals com tríceps como secundário credita 0.5 em tríceps
      [exercise('d0', 'pectorals', 'composto', ['triceps'])],
      // dia 2: delts com tríceps como secundário credita mais 0.5, somando
      // 1.0 em tríceps e batendo o teto antes do dia 3
      [exercise('d1', 'delts', 'composto', ['triceps'])],
      // dia 3: o exercício de tríceps isolado (alvo principal direto) já
      // encontra tríceps no teto e é preterido a favor da alternativa de abs
      [exercise('d3', 'triceps', 'isolado'), exercise('d4', 'abs', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 0, max: 1 }, 1)

    expect(result[0].map((e) => e.id)).toEqual(['d0'])
    expect(result[1].map((e) => e.id)).toEqual(['d1'])
    expect(result[2].map((e) => e.id)).toEqual(['d4'])
  })

  it('distributes exercises across all of a day\'s target muscles instead of letting one target monopolize the slots', () => {
    // Regressão: sem intercalar por alvo, a ordem crua da consulta (sem
    // ORDER BY) podia devolver os 6 exercícios de peito primeiro, fazendo o
    // dia inteiro de corpo inteiro virar treino de peito, sem nada de
    // costas ou perna.
    const pectorals = Array.from({ length: 6 }, (_, i) => exercise(`p${i + 1}`, 'pectorals', 'composto'))
    const lats = [exercise('l1', 'lats', 'composto'), exercise('l2', 'lats', 'composto')]
    const quads = [exercise('q1', 'quads', 'composto'), exercise('q2', 'quads', 'composto')]

    const candidatesByDay = [[...pectorals, ...lats, ...quads]]

    const result = planWeekExercises(candidatesByDay, { min: 0, max: 20 }, 6)

    const targetsChosen = result[0].map((e) => e.target)
    const countByTarget = {
      pectorals: targetsChosen.filter((t) => t === 'pectorals').length,
      lats: targetsChosen.filter((t) => t === 'lats').length,
      quads: targetsChosen.filter((t) => t === 'quads').length,
    }

    expect(countByTarget).toEqual({ pectorals: 2, lats: 2, quads: 2 })
  })
})
