import { NextResponse } from 'next/server'
import { chatWithTool, type ChatMessage } from '@/lib/openai/client'
import { generateFirstMonth } from '@/lib/plan-engine/generate-month'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = (await request.json()) as { messages: ChatMessage[] }

  const result = await chatWithTool(messages)

  if (result.type === 'message') {
    return NextResponse.json({ type: 'message', content: result.content })
  }

  const supabase = createServerSupabaseClient()

  const { data: profileRow, error } = await supabase
    .from('profile')
    .insert([
      {
        user_id: userId,
        goal: result.profile.goal,
        level: result.profile.level,
        days_per_week: result.profile.days_per_week,
        equipment: result.profile.equipment,
        restrictions: result.profile.restrictions,
        onboarding_transcript: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      },
    ])
    .select()
    .single()

  if (error || !profileRow) {
    throw new Error(error?.message ?? 'Failed to save profile')
  }

  try {
    const { trainingPlanId } = await generateFirstMonth(supabase, userId, result.profile)
    return NextResponse.json({ type: 'completed', trainingPlanId })
  } catch (generationError) {
    console.error('Failed to generate first month:', generationError)
    return NextResponse.json(
      {
        type: 'message',
        content:
          'Já existe um plano gerado para você este mês. Fale com o suporte se quiser recomeçar.',
      },
      { status: 200 }
    )
  }
}
