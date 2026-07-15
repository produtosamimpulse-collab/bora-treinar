import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSingle = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }))
const mockUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockGetPublicUrl = vi.hoisted(() =>
  vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example/exercise-gifs/0001.gif' } })
)

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      update: mockUpdate,
    }),
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

const originalFetch = global.fetch

import { GET } from './route'

describe('GET /api/exercises/:id/gif', () => {
  beforeEach(() => {
    mockSingle.mockReset()
    process.env.EXERCISEDB_API_KEY = 'test-key'
    process.env.EXERCISEDB_API_HOST = 'exercisedb.p.rapidapi.com'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('streams the cached gif with a long-lived Cache-Control header, without calling ExerciseDB', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'ex-1', external_id: '0001', media_url: 'https://storage.example/cached.gif' },
      error: null,
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    global.fetch = fetchSpy as unknown as typeof fetch

    const response = await GET(new Request('http://localhost/api/exercises/ex-1/gif'), {
      params: Promise.resolve({ id: 'ex-1' }),
    })

    expect(fetchSpy).toHaveBeenCalledWith('https://storage.example/cached.gif')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/gif')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('fetches from ExerciseDB, caches, and streams the gif when not yet cached', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'ex-1', external_id: '0001', media_url: null },
      error: null,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }) as unknown as typeof fetch

    const response = await GET(new Request('http://localhost/api/exercises/ex-1/gif'), {
      params: Promise.resolve({ id: 'ex-1' }),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exercisedb.p.rapidapi.com/image?exerciseId=0001'),
      expect.anything()
    )
    expect(mockUpload).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ media_url: 'https://storage.example/exercise-gifs/0001.gif' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/gif')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })
})
