import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import CheckinChat from './CheckinChat'

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>
}) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    redirect('/login')
  }

  const { planId } = await searchParams

  if (!planId) {
    redirect('/plano')
  }

  const supabase = createServerSupabaseClient()

  const { data: plan } = await supabase
    .from('training_plan')
    .select('user_id, month_number')
    .eq('id', planId)
    .maybeSingle()

  if (!plan || plan.user_id !== userId) {
    redirect('/plano')
  }

  return <CheckinChat trainingPlanId={planId} monthNumber={plan.month_number} />
}
