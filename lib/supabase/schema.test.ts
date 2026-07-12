import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

const EXPECTED_TABLES = [
  'profile',
  'exercise',
  'training_plan',
  'workout_day',
  'workout_day_exercise',
  'workout_session',
  'workout_session_set',
  'monthly_checkin',
  'body_metric',
]

describe('database schema', () => {
  it('creates all expected tables', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    )
    const tableNames = result.rows.map((r) => r.table_name)

    await client.end()

    for (const table of EXPECTED_TABLES) {
      expect(tableNames).toContain(table)
    }
  })
})
