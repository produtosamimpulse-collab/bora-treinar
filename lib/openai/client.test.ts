import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { chatWithTool } from './client'

describe('chatWithTool', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a plain message when the model does not call the tool', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Qual seu objetivo?', tool_calls: undefined } }],
    })

    const result = await chatWithTool([{ role: 'user', content: 'Oi' }])

    expect(result).toEqual({ type: 'message', content: 'Qual seu objetivo?' })
  })

  it('returns the extracted profile when the model calls completar_onboarding', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 4,
      equipment: 'academia completa',
      restrictions: null,
    }

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                function: { name: 'completar_onboarding', arguments: JSON.stringify(profile) },
              },
            ],
          },
        },
      ],
    })

    const result = await chatWithTool([{ role: 'user', content: 'Já disse tudo' }])

    expect(result).toEqual({ type: 'tool_call', profile })
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(chatWithTool([{ role: 'user', content: 'Oi' }])).rejects.toThrow(
      'Missing OPENAI_API_KEY'
    )
  })
})
