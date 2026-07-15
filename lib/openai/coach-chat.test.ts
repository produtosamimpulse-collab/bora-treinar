import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { chatWithCoach } from './coach-chat'

describe('chatWithCoach', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Resposta do treinador' } }],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the assistant reply as plain text', async () => {
    const result = await chatWithCoach([{ role: 'user', content: 'Por que esse exercício?' }], null)

    expect(result).toBe('Resposta do treinador')
  })

  it('sends no tools, since the coach chat never mutates the plan directly', async () => {
    await chatWithCoach([{ role: 'user', content: 'Oi' }], null)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.tools).toBeUndefined()
  })

  it('includes the real plan context in the system prompt when provided', async () => {
    await chatWithCoach([{ role: 'user', content: 'Oi' }], {
      goal: 'hipertrofia',
      level: 'intermediario',
      daysPerWeek: 4,
      currentWeek: 2,
      weekType: 'progressao',
      days: [
        {
          dayLabel: 'Peito, Costas e Ombros',
          exercises: [{ name: 'Supino reto', targetSets: 4, targetReps: 10, targetRir: '1-2' }],
          cardio: null,
        },
      ],
    })

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages[0].content as string

    expect(systemMessage).toContain('hipertrofia')
    expect(systemMessage).toContain('Supino reto')
    expect(systemMessage).toContain('Semana atual do plano: 2 de 4')
  })

  it('never uses markdown formatting instructions loosely - explicitly forbids it', async () => {
    await chatWithCoach([{ role: 'user', content: 'Oi' }], null)

    const callArgs = mockCreate.mock.calls[0][0]
    const systemMessage = callArgs.messages[0].content as string

    expect(systemMessage).toContain('Nunca use markdown')
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(chatWithCoach([{ role: 'user', content: 'Oi' }], null)).rejects.toThrow(
      'Missing OPENAI_API_KEY'
    )
  })
})
