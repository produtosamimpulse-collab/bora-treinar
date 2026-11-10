import { describe, expect, it } from 'vitest'
import { opcoesDeTroca } from './trocas'
import { POSICIONAMENTO } from './posicionamento'
import { EXERCICIOS, TODOS_OS_TREINOS, agruparTreinos, buscarTreino, ehTempo, resumoDoTreino, ORDEM_LAIS, ORDEM_POR_PARTE } from '.'

describe('trocas de exercício', () => {
  it('oferece só o mesmo músculo e tira o que já está no treino', () => {
    const opcoes = opcoesDeTroca('supino-reto-com-halteres', ['crossover-na-polia'])
    expect(opcoes.length).toBeGreaterThan(0)
    expect(opcoes).not.toContain('supino-reto-com-halteres')
    expect(opcoes).not.toContain('crossover-na-polia')
    expect(opcoes.every((s) => EXERCICIOS[s].grupo === 'peito')).toBe(true)
  })

  it('nunca oferece outro músculo, só o mesmo', () => {
    const opcoes = opcoesDeTroca('stiff-com-halteres', ['mesa-flexora', 'cadeira-flexora'])
    expect(opcoes.length).toBeGreaterThan(0)
    expect(opcoes.every((s) => EXERCICIOS[s].grupo === 'posterior')).toBe(true)
  })

  it('quando o treino usa todos do músculo, ainda oferece do mesmo músculo', () => {
    const peito = Object.keys(EXERCICIOS).filter((s) => EXERCICIOS[s].grupo === 'peito')
    const opcoes = opcoesDeTroca(peito[0], peito)
    expect(opcoes.length).toBeGreaterThan(0)
    expect(opcoes.every((s) => EXERCICIOS[s].grupo === 'peito')).toBe(true)
    expect(opcoes).not.toContain(peito[0])
  })

  it('exercício desconhecido não tem troca', () => {
    expect(opcoesDeTroca('nao-existe', [])).toEqual([])
  })
})

describe('posicionamento', () => {
  it('todo exercício do catálogo tem posição, e só ele', () => {
    expect(Object.keys(POSICIONAMENTO).sort()).toEqual(Object.keys(EXERCICIOS).sort())
  })

  it('não usa travessão', () => {
    for (const p of Object.values(POSICIONAMENTO)) expect(p.texto).not.toMatch(/[—–]/)
  })
})

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
