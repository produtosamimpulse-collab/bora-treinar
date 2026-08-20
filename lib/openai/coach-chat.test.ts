import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { chatWithCoach, type CoachTools } from './coach-chat'

function makeTools(overrides?: Partial<CoachTools>): CoachTools {
  return {
    listAlternatives: overrides?.listAlternatives ?? vi.fn().mockResolvedValue([]),
    applySwap: overrides?.applySwap ?? vi.fn().mockResolvedValue({ error: 'not called' }),
    searchExercises: overrides?.searchExercises ?? vi.fn().mockResolvedValue([]),
    rebuildDay: overrides?.rebuildDay ?? vi.fn().mockResolvedValue({ error: 'not called' }),
  }
}

describe('chatWithCoach', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the assistant reply directly when no tool call is made', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Isso é normal, pode continuar', tool_calls: undefined } }],
    })

    const result = await chatWithCoach([{ role: 'user', content: 'Minha perna cansa rápido' }], null, makeTools())

    expect(result).toEqual({ content: 'Isso é normal, pode continuar', swapped: null, rebuilt: null })
  })

  it('exposes only the four tools that touch the plan through the engine', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Oi', tool_calls: undefined } }] })

    await chatWithCoach([{ role: 'user', content: 'Oi' }], null, makeTools())

    const callArgs = mockCreate.mock.calls[0][0]
    const toolNames = callArgs.tools.map((t: { function: { name: string } }) => t.function.name)
    expect(toolNames).toEqual([
      'listar_alternativas',
      'trocar_exercicio',
      'buscar_exercicios',
      'refazer_treino_do_dia',
    ])
  })

  it('calls listar_alternativas, feeds the result back, and returns the final text', async () => {
    const listAlternatives = vi.fn().mockResolvedValue([{ id: 'ex-9', name: 'Elevação lateral' }])

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'listar_alternativas', arguments: JSON.stringify({ workout_day_exercise_id: 'wde-1' }) },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Que tal elevação lateral no lugar?', tool_calls: undefined } }],
      })

    const result = await chatWithCoach(
      [{ role: 'user', content: 'Meu ombro dói nesse exercício' }],
      null,
      makeTools({ listAlternatives })
    )

    expect(listAlternatives).toHaveBeenCalledWith('wde-1')
    expect(result.content).toBe('Que tal elevação lateral no lugar?')
    expect(result.swapped).toBeNull()
    expect(mockCreate).toHaveBeenCalledTimes(2)

    // a segunda chamada precisa incluir a resposta da ferramenta como contexto
    const secondCallMessages = mockCreate.mock.calls[1][0].messages
    const toolMessage = secondCallMessages.find((m: { role: string }) => m.role === 'tool')
    expect(JSON.parse(toolMessage.content)).toEqual([{ id: 'ex-9', name: 'Elevação lateral' }])
  })

  it('reports a real swap when trocar_exercicio succeeds', async () => {
    const applySwap = vi.fn().mockResolvedValue({ id: 'ex-9', name: 'Lateral Raise', name_pt: 'Elevação lateral' })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'trocar_exercicio',
                    arguments: JSON.stringify({ workout_day_exercise_id: 'wde-1', novo_exercicio_id: 'ex-9' }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Troquei pra elevação lateral.', tool_calls: undefined } }],
      })

    const result = await chatWithCoach([{ role: 'user', content: 'Troca esse aí' }], null, makeTools({ applySwap }))

    expect(applySwap).toHaveBeenCalledWith('wde-1', 'ex-9')
    expect(result.swapped).toEqual({ workoutDayExerciseId: 'wde-1', id: 'ex-9', name: 'Elevação lateral' })
  })

  it('does not report a swap when trocar_exercicio fails', async () => {
    const applySwap = vi.fn().mockResolvedValue({ error: 'Invalid replacement exercise' })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'trocar_exercicio',
                    arguments: JSON.stringify({ workout_day_exercise_id: 'wde-1', novo_exercicio_id: 'ex-bad' }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Não consegui trocar esse.', tool_calls: undefined } }],
      })

    const result = await chatWithCoach([{ role: 'user', content: 'Troca esse aí' }], null, makeTools({ applySwap }))

    expect(result.swapped).toBeNull()
  })

  it('reports the rebuilt day when refazer_treino_do_dia succeeds', async () => {
    const searchExercises = vi
      .fn()
      .mockResolvedValue([{ id: 'ex-1', name: 'Stiff', target: 'hamstrings', mechanic: 'composto' }])
    const rebuildDay = vi.fn().mockResolvedValue({
      dayLabel: 'Posterior e Glúteos',
      exercises: [
        {
          id: 'wde-new',
          exerciseId: 'ex-1',
          name: 'Stiff',
          targetSets: 4,
          targetReps: 8,
          targetRir: '1-2',
        },
      ],
    })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'buscar_exercicios',
                    arguments: JSON.stringify({ grupos_musculares: ['hamstrings'] }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-2',
                  type: 'function',
                  function: {
                    name: 'refazer_treino_do_dia',
                    arguments: JSON.stringify({
                      exercicio_ids: ['ex-1'],
                      titulo_do_dia: 'Posterior e Glúteos',
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Montei um treino só de posterior.', tool_calls: undefined } }],
      })

    const result = await chatWithCoach(
      [{ role: 'user', content: 'hoje eu quero só posterior' }],
      null,
      makeTools({ searchExercises, rebuildDay })
    )

    expect(searchExercises).toHaveBeenCalledWith({ targets: ['hamstrings'], nameQuery: undefined })
    expect(rebuildDay).toHaveBeenCalledWith({
      exerciseIds: ['ex-1'],
      dayLabel: 'Posterior e Glúteos',
    })
    expect(result.rebuilt?.dayLabel).toBe('Posterior e Glúteos')
    expect(result.rebuilt?.exercises).toHaveLength(1)
    expect(result.content).toBe('Montei um treino só de posterior.')
  })

  it('does not report a rebuild when refazer_treino_do_dia is refused', async () => {
    const rebuildDay = vi.fn().mockResolvedValue({ error: 'Esse treino já foi concluído' })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'refazer_treino_do_dia',
                    arguments: JSON.stringify({ exercicio_ids: ['ex-1'], titulo_do_dia: 'Posterior' }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Esse treino já foi feito, não dá pra mudar.', tool_calls: undefined } }],
      })

    const result = await chatWithCoach(
      [{ role: 'user', content: 'muda o treino' }],
      null,
      makeTools({ rebuildDay })
    )

    expect(result.rebuilt).toBeNull()
  })

  it('includes the day context with exercise ids in the system prompt', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Oi', tool_calls: undefined } }] })

    await chatWithCoach([{ role: 'user', content: 'Oi' }], {
      goal: 'hipertrofia',
      level: 'intermediario',
      dayLabel: 'Peito, Costas e Ombros',
      exercisesPerDay: 6,
      exercises: [{ workoutDayExerciseId: 'wde-1', name: 'Supino reto', targetSets: 4, targetReps: 10, targetRir: '1-2' }],
    }, makeTools())

    const systemMessage = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(systemMessage).toContain('wde-1')
    expect(systemMessage).toContain('Supino reto')
    expect(systemMessage).toContain('Nunca use markdown')
    // o vocabulário de grupos musculares precisa chegar ao prompt, senão a IA
    // chuta valores de `target` que não existem no banco
    expect(systemMessage).toContain('hamstrings (posterior de coxa)')
    expect(systemMessage).toContain('6 exercícios por dia')
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(chatWithCoach([{ role: 'user', content: 'Oi' }], null, makeTools())).rejects.toThrow(
      'Missing OPENAI_API_KEY'
    )
  })
})
