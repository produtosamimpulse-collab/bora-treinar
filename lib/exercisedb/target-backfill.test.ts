import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise.target backfill', () => {
  it('has target populated for the vast majority of rows', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT COUNT(*)::int AS total, COUNT(target)::int AS with_target FROM exercise`
    )

    await client.end()

    const { total, with_target } = result.rows[0]
    expect(with_target).toBeGreaterThan(total * 0.95)
  })
})
