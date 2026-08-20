import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'
import { applySwap } from '@/lib/plan-engine/exercise-swap'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
  }

  const { id } = await params
  const { exerciseId } = (await request.json()) as { exerciseId: string }

  if (!exerciseId) {
    return NextResponse.json({ error: 'Missing exerciseId' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const result = await applySwap(supabase, id, exerciseId, userId)

  if ('error' in result) {
    const status = result.error === 'Exercise not found' ? 404 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
