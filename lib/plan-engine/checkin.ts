import type { SupabaseClient } from '@supabase/supabase-js'
import { generateNextMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

export type CheckinInput = {
  weightKg: number | null
  painSignal: boolean
  motivationLevel: number | null
  difficultyLevel: number | null
  adjustmentDecision: string | null
  conversationSummary: string | null
  measurements: Record<string, number> | null
}

export type CheckinResult = { trainingPlanId: string } | { error: string }

export async function submitMonthlyCheckin(
  supabase: SupabaseClient,
  userId: string,
  trainingPlanId: string,
  input: CheckinInput
): Promise<CheckinResult> {
  const { data: plan, error: planError } = await supabase
    .from('training_plan')
    .select('user_id, month_number, reference_month')
    .eq('id', trainingPlanId)
    .maybeSingle()

  if (planError) {
    throw new Error(planError.message)
  }

  if (!plan || plan.user_id !== userId) {
    return { error: 'Plano não encontrado' }
  }

  const { data: existing, error: existingError } = await supabase
    .from('monthly_checkin')
    .select('id')
    .eq('user_id', userId)
    .eq('reference_month', plan.reference_month)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return { error: 'Você já fez o check-in desse mês' }
  }

  const { data: checkin, error: checkinError } = await supabase
    .from('monthly_checkin')
    .insert([
      {
        user_id: userId,
        reference_month: plan.reference_month,
        conversation_summary: input.conversationSummary,
        pain_signal: input.painSignal,
        motivation_level: input.motivationLevel,
        difficulty_level: input.difficultyLevel,
        adjustment_decision: input.adjustmentDecision,
      },
    ])
    .select()
    .single()

  if (checkinError) {
    throw new Error(checkinError.message)
  }

  const { error: metricError } = await supabase.from('body_metric').insert([
    {
      user_id: userId,
      monthly_checkin_id: checkin.id,
      weight_kg: input.weightKg,
      measurements: input.measurements,
    },
  ])

  if (metricError) {
    throw new Error(metricError.message)
  }

  const { data: profileRow } = await supabase
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const profile: OnboardingProfile = {
    goal: profileRow.goal,
    level: profileRow.level,
    days_per_week: profileRow.days_per_week,
    equipment: profileRow.equipment,
    restrictions: profileRow.restrictions,
    session_minutes: profileRow.session_minutes,
    age: profileRow.age,
    sex: profileRow.sex,
    training_history: profileRow.training_history,
    excluded_targets: profileRow.excluded_targets ?? [],
  }

  const nextMonth = await generateNextMonth(supabase, userId, profile, plan.month_number)

  return { trainingPlanId: nextMonth.trainingPlanId }
}
