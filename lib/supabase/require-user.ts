import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from './session'

// Repete o guard de autenticação comum a todas as rotas de API: pega o userId
// autenticado ou já devolve a resposta 401 pronta pra ser retornada.
export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return userId
}
