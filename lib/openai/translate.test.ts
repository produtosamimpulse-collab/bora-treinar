import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return { chat: { completions: { create: mockCreate } } }
  }),
}))

import { translateExerciseBatch } from './translate'

describe('translateExerciseBatch', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('sends exercises to the model and returns the parsed translations', async () => {
    const input = [
      { id: '1', name: 'push-up', muscle_group: 'chest', instructions: 'Lower your body.' },
    ]
    const output = {
      translations: [
        { id: '1', name_pt: 'flexão', muscle_group_pt: 'peito', instructions_pt: 'Abaixe o corpo.' },
      ],
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(output) } }],
    })

    const result = await translateExerciseBatch(input)

    expect(result).toEqual(output.translations)
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(translateExerciseBatch([])).rejects.toThrow('Missing OPENAI_API_KEY')
  })
})
