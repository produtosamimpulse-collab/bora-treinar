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

  it('calls the ExerciseDB API with the right headers and returns the parsed list', async () => {
    const mockExercises = [
      {
        id: '0001',
        name: '3/4 sit-up',
        bodyPart: 'waist',
        equipment: 'body weight',
        target: 'abs',
        secondaryMuscles: ['hip flexors', 'lower back'],
        instructions: ['Lie flat on your back...', 'Engage your abs...'],
        description: 'The 3/4 sit-up is an abdominal exercise...',
        difficulty: 'beginner',
        category: 'strength',
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExercises,
    }) as unknown as typeof fetch

    const result = await fetchAllExercises()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exercisedb.p.rapidapi.com/exercises'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-RapidAPI-Key': 'test-key',
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        }),
      })
    )
    expect(result).toEqual(mockExercises)
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
