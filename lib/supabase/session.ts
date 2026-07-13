import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Reads the caller's session from request cookies to get their real,
// verified user id. Route handlers must use this instead of trusting a
// client-supplied userId in the request body, since createServerSupabaseClient
// uses the service_role key and bypasses RLS.
export async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Route handlers in this app don't need to refresh session
          // cookies here; the proxy already keeps them fresh on navigation.
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}
