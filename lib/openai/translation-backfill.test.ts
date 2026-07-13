import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise translation backfill', () => {
  it('has name_pt populated for the vast majority of rows', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT COUNT(*)::int AS total, COUNT(name_pt)::int AS translated FROM exercise`
    )

    await client.end()

    const { total, translated } = result.rows[0]
    expect(translated).toBeGreaterThan(total * 0.9)
  })
})
