import { describe, it, expect } from 'vitest'
import { createServerSupabaseClient } from './server'

describe('createServerSupabaseClient', () => {
  it('connects and can query the exercise table', async () => {
    const client = createServerSupabaseClient()
    const { data, error } = await client.from('exercise').select('*').limit(1)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
