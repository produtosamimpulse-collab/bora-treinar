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
        session_minutes: result.profile.session_minutes,
        age: result.profile.age,
        sex: result.profile.sex,
        training_history: result.profile.training_history,
        excluded_targets: result.profile.excluded_targets,
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

    const referenceMonth = new Date()
    referenceMonth.setDate(1)

    const { data: existingPlan } = await supabase
      .from('training_plan')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_month', referenceMonth.toISOString().slice(0, 10))
      .maybeSingle()

    if (existingPlan) {
      return NextResponse.json({ type: 'completed', trainingPlanId: existingPlan.id })
    }

    return NextResponse.json(
      {
        type: 'message',
        content:
          'Algo deu errado ao gerar seu plano. Tente enviar sua última mensagem de novo.',
      },
      { status: 200 }
    )
  }
}
