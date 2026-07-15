import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { chatWithCheckin, type CheckinTools } from './checkin-chat'

function makeTools(overrides?: Partial<CheckinTools>): CheckinTools {
  return {
    finalizeCheckin: overrides?.finalizeCheckin ?? vi.fn().mockResolvedValue({ error: 'not called' }),
  }
}

describe('chatWithCheckin', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the assistant reply directly when no tool call is made', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'E aí, como foi o mês? Bateu a meta de treinos?', tool_calls: undefined } }],
    })

    const result = await chatWithCheckin([{ role: 'user', content: 'Oi' }], null, makeTools())

    expect(result).toEqual({
      content: 'E aí, como foi o mês? Bateu a meta de treinos?',
      completed: false,
      trainingPlanId: null,
    })
  })

  it('only sends the finalizar_checkin tool', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Oi', tool_calls: undefined } }] })

    await chatWithCheckin([{ role: 'user', content: 'Oi' }], null, makeTools())

    const callArgs = mockCreate.mock.calls[0][0]
    const toolNames = callArgs.tools.map((t: { function: { name: string } }) => t.function.name)
    expect(toolNames).toEqual(['finalizar_checkin'])
  })

  it('calls finalizeCheckin with the mapped fields and reports completion on success', async () => {
    const finalizeCheckin = vi.fn().mockResolvedValue({ trainingPlanId: 'plan-2' })

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
                    name: 'finalizar_checkin',
                    arguments: JSON.stringify({
                      peso_kg: 70.5,
                      sinal_de_dor: false,
                      nivel_motivacao: 4,
                      nivel_dificuldade: 3,
                      medidas: { cintura: 80 },
                      decisao_de_ajuste: 'Manter progressão normal',
                      resumo_da_conversa: 'Mês tranquilo, sem dores.',
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Show, já preparei o próximo mês!', tool_calls: undefined } }],
      })

    const result = await chatWithCheckin(
      [{ role: 'user', content: 'Terminei o mês, pesando 70.5kg, tranquilo' }],
      null,
      makeTools({ finalizeCheckin })
    )

    expect(finalizeCheckin).toHaveBeenCalledWith({
      weightKg: 70.5,
      painSignal: false,
      motivationLevel: 4,
      difficultyLevel: 3,
      adjustmentDecision: 'Manter progressão normal',
      conversationSummary: 'Mês tranquilo, sem dores.',
      measurements: { cintura: 80 },
    })
    expect(result).toEqual({
      content: 'Show, já preparei o próximo mês!',
      completed: true,
      trainingPlanId: 'plan-2',
    })
  })

  it('does not report completion when finalizeCheckin fails', async () => {
    const finalizeCheckin = vi.fn().mockResolvedValue({ error: 'Você já fez o check-in desse mês' })

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
                    name: 'finalizar_checkin',
                    arguments: JSON.stringify({
                      sinal_de_dor: false,
                      decisao_de_ajuste: 'Manter',
                      resumo_da_conversa: 'Resumo',
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Já tinha registrado esse mês.', tool_calls: undefined } }],
      })

    const result = await chatWithCheckin([{ role: 'user', content: 'Terminei' }], null, makeTools({ finalizeCheckin }))

    expect(result.completed).toBe(false)
    expect(result.trainingPlanId).toBeNull()
  })

  it('includes month and goal context in the system prompt', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Oi', tool_calls: undefined } }] })

    await chatWithCheckin(
      [{ role: 'user', content: 'Oi' }],
      { goal: 'hipertrofia', level: 'intermediario', monthNumber: 2 },
      makeTools()
    )

    const systemMessage = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(systemMessage).toContain('mês 2')
    expect(systemMessage).toContain('hipertrofia')
    expect(systemMessage).toContain('Nunca use markdown')
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(chatWithCheckin([{ role: 'user', content: 'Oi' }], null, makeTools())).rejects.toThrow(
      'Missing OPENAI_API_KEY'
    )
  })
})
