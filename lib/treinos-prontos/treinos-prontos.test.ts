import { describe, expect, it } from 'vitest'
import { EXERCICIOS, TODOS_OS_TREINOS, agruparTreinos, buscarTreino, ehTempo, resumoDoTreino, ORDEM_LAIS, ORDEM_POR_PARTE } from '.'

describe('treinos prontos', () => {
  it('todo exercício usado existe no catálogo', () => {
    for (const treino of TODOS_OS_TREINOS) {
      for (const item of treino.itens) {
        expect(EXERCICIOS[item.exercicio], `${treino.slug}: ${item.exercicio}`).toBeDefined()
      }
    }
  })

  it('slugs não se repetem', () => {
    const slugs = TODOS_OS_TREINOS.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('agrupa por parte do corpo e pelos treinos da Laís na ordem', () => {
    expect(agruparTreinos('parte', ORDEM_POR_PARTE).map((b) => b.grupo)).toEqual(ORDEM_POR_PARTE)
    expect(agruparTreinos('lais', ORDEM_LAIS).map((b) => b.grupo)).toEqual(ORDEM_LAIS)
    expect(agruparTreinos('lais', ORDEM_LAIS).flatMap((b) => b.treinos)).toHaveLength(11)
  })

  it('acha treino pelo slug', () => {
    expect(buscarTreino('gluteo')?.nome).toBe('Glúteo')
    expect(buscarTreino('nao-existe')).toBeUndefined()
  })

  it('reconhece repetição por tempo', () => {
    expect(ehTempo('30 segundos')).toBe(true)
    expect(ehTempo('10 minutos')).toBe(true)
    expect(ehTempo('12 cada perna')).toBe(false)
  })

  it('resume o treino com exercícios e minutos', () => {
    expect(resumoDoTreino(buscarTreino('cardio-esteira-30')!)).toBe('~30 min')
    expect(resumoDoTreino(buscarTreino('gluteo')!)).toMatch(/^6 exercícios · ~\d+ min$/)
  })
})
