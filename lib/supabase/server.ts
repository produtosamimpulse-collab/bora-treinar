import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Uses the service_role key, which bypasses Row Level Security entirely.
// Only call this from trusted server-side code — never expose it to untrusted request handlers without additional authorization checks.
export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(url, key)
}
