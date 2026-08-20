import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'
import { getSwapOptions } from '@/lib/plan-engine/exercise-swap'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
  }

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const options = await getSwapOptions(supabase, id, userId)

  if (options === null) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  return NextResponse.json(options)
}
