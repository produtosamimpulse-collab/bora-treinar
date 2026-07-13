import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise table after sync', () => {
  it('has a substantial number of exercises populated', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query('SELECT COUNT(*)::int AS count FROM exercise')

    await client.end()

    expect(result.rows[0].count).toBeGreaterThan(500)
  })
})
