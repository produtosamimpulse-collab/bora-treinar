import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// O Supabase pausa projetos do plano free depois de alguns dias sem nenhuma
// chamada, e quando isso acontece o app inteiro cai: o banco some do DNS e
// nem a tela de login funciona. Um cron da Vercel bate aqui todo dia só pra
// deixar registro de atividade. Uma leitura barata já conta.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('exercise').select('id').limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
