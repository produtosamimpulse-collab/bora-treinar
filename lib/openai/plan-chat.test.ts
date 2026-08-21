import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { chatWithPlanCoach, type PlanTools, type PlanContext } from './plan-chat'

function makeTools(overrides?: Partial<PlanTools>): PlanTools {
  return {
    searchExercises: overrides?.searchExercises ?? vi.fn().mockResolvedValue([]),
    rebuildDay: overrides?.rebuildDay ?? vi.fn().mockResolvedValue({ error: 'not called' }),
  }
}

function makeContext(): PlanContext {
  return {
    goal: 'hipertrofia',
    level: 'intermediario',
    daysPerWeek: 4,
    monthNumber: 2,
    currentWeek: 3,
    weekType: 'progressao',
    days: [
      {
        workoutDayId: 'day-seg',
        weekNumber: 3,
        weekdayName: 'segunda',
        dayLabel: 'Peito, Costas e Ombros',
        completed: true,
        isCurrentWeek: true,
        exercises: ['Supino reto'],
      },
      {
        workoutDayId: 'day-qui',
        weekNumber: 3,
        weekdayName: 'quinta',
        dayLabel: 'Pernas e Glúteos',
        completed: false,
        isCurrentWeek: true,
        exercises: ['Agachamento livre'],
      },
    ],
  }
}

function toolCall(id: string, name: string, args: unknown) {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } }
}

describe('chatWithPlanCoach', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('answers directly when no tool is needed', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Seu mês está equilibrado', tool_calls: undefined } }],
    })

    const result = await chatWithPlanCoach([{ role: 'user', content: 'como está meu mês?' }], null, makeTools())

    expect(result).toEqual({ content: 'Seu mês está equilibrado', rebuiltDayIds: [] })
  })

  it('puts every day of the month in the prompt, with ids and what is already done', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Oi', tool_calls: undefined } }] })

    await chatWithPlanCoach([{ role: 'user', content: 'oi' }], makeContext(), makeTools())

    const systemMessage = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(systemMessage).toContain('day-qui')
    expect(systemMessage).toContain('quinta')
    expect(systemMessage).toContain('já treinado')
    expect(systemMessage).toContain('em aberto')
    expect(systemMessage).toContain('Nunca use markdown')
  })

  it('rebuilds the day the model picked and reports it back', async () => {
    const rebuildDay = vi.fn().mockResolvedValue({ dayLabel: 'Posterior', exercises: [] })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                toolCall('c1', 'refazer_treino_do_dia', {
                  workout_day_id: 'day-qui',
                  exercicio_ids: ['ex-1'],
                  titulo_do_dia: 'Posterior',
                }),
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Quinta virou dia de posterior.', tool_calls: undefined } }],
      })

    const result = await chatWithPlanCoach(
      [{ role: 'user', content: 'deixa a quinta só de posterior' }],
      makeContext(),
      makeTools({ rebuildDay })
    )

    expect(rebuildDay).toHaveBeenCalledWith('day-qui', {
      exerciseIds: ['ex-1'],
      dayLabel: 'Posterior',
    })
    expect(result.rebuiltDayIds).toEqual(['day-qui'])
  })

  it('reorganizes several days in one conversation', async () => {
    const rebuildDay = vi.fn().mockResolvedValue({ dayLabel: 'Novo', exercises: [] })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                toolCall('c1', 'refazer_treino_do_dia', { workout_day_id: 'day-qui', exercicio_ids: ['a'], titulo_do_dia: 'A' }),
                toolCall('c2', 'refazer_treino_do_dia', { workout_day_id: 'day-seg', exercicio_ids: ['b'], titulo_do_dia: 'B' }),
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Semana reorganizada.', tool_calls: undefined } }] })

    const result = await chatWithPlanCoach(
      [{ role: 'user', content: 'reorganiza a semana' }],
      makeContext(),
      makeTools({ rebuildDay })
    )

    expect(result.rebuiltDayIds).toEqual(['day-qui', 'day-seg'])
  })

  it('does not report a day the engine refused, like one already trained', async () => {
    const rebuildDay = vi.fn().mockResolvedValue({ error: 'Esse treino já foi concluído' })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                toolCall('c1', 'refazer_treino_do_dia', { workout_day_id: 'day-seg', exercicio_ids: ['a'], titulo_do_dia: 'A' }),
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'A segunda você já treinou, não dá pra mudar.', tool_calls: undefined } }],
      })

    const result = await chatWithPlanCoach(
      [{ role: 'user', content: 'muda a segunda' }],
      makeContext(),
      makeTools({ rebuildDay })
    )

    expect(result.rebuiltDayIds).toEqual([])
  })

  it('passes the beach tennis focus through to the search', async () => {
    const searchExercises = vi.fn().mockResolvedValue([])

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [toolCall('c1', 'buscar_exercicios', { foco_beach_tennis: ['potencia_salto'] })],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Achei', tool_calls: undefined } }] })

    await chatWithPlanCoach(
      [{ role: 'user', content: 'põe um dia de beach tennis' }],
      makeContext(),
      makeTools({ searchExercises })
    )

    expect(searchExercises).toHaveBeenCalledWith({
      groups: undefined,
      nameQuery: undefined,
      beach: ['potencia_salto'],
    })
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      chatWithPlanCoach([{ role: 'user', content: 'oi' }], null, makeTools())
    ).rejects.toThrow('Missing OPENAI_API_KEY')
  })
})
