import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllExercises } from './client'

describe('fetchAllExercises', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.EXERCISEDB_API_KEY = 'test-key'
    process.env.EXERCISEDB_API_HOST = 'exercisedb.p.rapidapi.com'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('paginates through the API until a page returns fewer than 10 items', async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1).padStart(4, '0'),
      name: `exercise-${i + 1}`,
      bodyPart: 'chest',
      equipment: 'body weight',
      target: 'pectorals',
      secondaryMuscles: [],
      instructions: ['Step 1'],
      description: 'desc',
      difficulty: 'beginner',
      category: 'strength',
    }))
    const page2 = page1.slice(0, 3).map((e) => ({ ...e, id: `p2-${e.id}` }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchAllExercises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('offset=0'),
      expect.anything()
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('offset=10'),
      expect.anything()
    )
    expect(result).toHaveLength(13)
  })

  it('throws when the API responds with an error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    await expect(fetchAllExercises()).rejects.toThrow('ExerciseDB request failed: 401')
  })

  it('throws when credentials are missing', async () => {
    delete process.env.EXERCISEDB_API_KEY
    delete process.env.EXERCISEDB_API_HOST

    await expect(fetchAllExercises()).rejects.toThrow('Missing ExerciseDB API credentials')
  })
})
