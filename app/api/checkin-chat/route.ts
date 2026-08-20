import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/supabase/require-user'
import { submitMonthlyCheckin } from '@/lib/plan-engine/checkin'
import { chatWithCheckin, type CheckinContext } from '@/lib/openai/checkin-chat'
import type { ChatMessage } from '@/lib/openai/client'

async function buildCheckinContext(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  trainingPlanId: string
): Promise<CheckinContext | null> {
  const { data: plan } = await supabase
    .from('training_plan')
    .select('user_id, month_number, goal')
    .eq('id', trainingPlanId)
    .maybeSingle()

  if (!plan || plan.user_id !== userId) {
    return null
  }

  const { data: profile } = await supabase
    .from('profile')
    .select('level')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    goal: plan.goal,
    level: profile?.level ?? '',
    monthNumber: plan.month_number,
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId()

  if (userId instanceof NextResponse) {
    return userId
  }

  const { messages, trainingPlanId } = (await request.json()) as {
    messages: ChatMessage[]
    trainingPlanId: string
  }

  const supabase = createServerSupabaseClient()
  const context = await buildCheckinContext(supabase, userId, trainingPlanId)

  const result = await chatWithCheckin(messages, context, {
    finalizeCheckin: (args) =>
      submitMonthlyCheckin(supabase, userId, trainingPlanId, {
        weightKg: args.weightKg,
        painSignal: args.painSignal,
        motivationLevel: args.motivationLevel,
        difficultyLevel: args.difficultyLevel,
        adjustmentDecision: args.adjustmentDecision,
        conversationSummary: args.conversationSummary,
        measurements: args.measurements,
      }),
  })

  return NextResponse.json(result)
}
