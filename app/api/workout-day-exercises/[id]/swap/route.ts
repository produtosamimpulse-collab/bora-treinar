import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: current, error: currentError } = await supabase
    .from('workout_day_exercise')
    .select('id, workout_day_id, exercise_id, exercise:exercise_id(target)')
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const { data: usedRows } = await supabase
    .from('workout_day_exercise')
    .select('exercise_id')
    .eq('workout_day_id', current.workout_day_id)

  const usedIds = (usedRows ?? []).map((row) => row.exercise_id)
  const target = (current.exercise as unknown as { target: string }).target

  const { data: candidates, error: candidateError } = await supabase
    .from('exercise')
    .select('id, name, name_pt')
    .eq('target', target)
    .not('id', 'in', `(${usedIds.join(',')})`)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')
    .limit(1)

  if (candidateError) {
    throw new Error(candidateError.message)
  }

  const candidate = candidates?.[0]

  if (!candidate) {
    return NextResponse.json({ error: 'No alternative exercise available' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('workout_day_exercise')
    .update({ exercise_id: candidate.id })
    .eq('id', id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return NextResponse.json(candidate)
}
