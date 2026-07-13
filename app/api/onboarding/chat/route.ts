import { NextResponse } from 'next/server'
import { chatWithTool, type ChatMessage } from '@/lib/openai/client'
import { generateFirstMonth } from '@/lib/plan-engine/generate-month'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { userId, messages } = (await request.json()) as {
    userId: string
    messages: ChatMessage[]
  }

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

  const { trainingPlanId } = await generateFirstMonth(supabase, userId, result.profile)

  return NextResponse.json({ type: 'completed', trainingPlanId })
}
