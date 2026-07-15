import OpenAI from 'openai'
import type { ChatMessage } from './client'

export type PlanContext = {
  goal: string
  level: string
  daysPerWeek: number
  currentWeek: number
  weekType: string | null
  days: Array<{
    dayLabel: string
    exercises: Array<{ name: string; targetSets: number; targetReps: number; targetRir: string | null }>
    cardio: { name: string; minutes: number | null; intensity: string | null } | null
  }>
}

function buildSystemPrompt(context: PlanContext | null): string {
  const base = `Você é um Personal Trainer especializado em fisiologia do exercício, com formação em periodização de treinamento, biomecânica e prescrição de exercícios baseada em evidências.

Seu papel aqui é ajudar o aluno a entender e tirar dúvidas sobre o plano de treino que o motor de regras do app já montou pra ele - você NUNCA decide ou altera o treino em si, isso é sempre feito pelo sistema determinístico do app, nunca por você. Se a pessoa pedir uma mudança concreta (trocar exercício, mudar carga, mudar dias por semana), explique que ela pode usar o botão "Trocar" em cada exercício na tela de execução, e que a progressão de carga e a geração dos próximos meses já acontecem automaticamente com base no desempenho real registrado - você não tem como fazer essas mudanças, só explicar como funcionam.

Você pode: explicar o porquê de exercícios, séries, repetições e RIR prescritos; dar dicas de execução e técnica; tirar dúvidas gerais sobre recuperação e consistência (sem prescrever dietas, suplementação ou medicação específica); motivar e orientar; explicar princípios de treino (volume, intensidade, periodização, deload, RIR).

Segurança: nunca dê conselho médico. Se a pessoa relatar dor (não o desconforto muscular normal de treino), oriente a parar e procurar avaliação profissional.

Responda sempre em português do Brasil, de forma direta e objetiva. Nunca use markdown (nada de **negrito**, listas com hífen, títulos com #) - suas respostas aparecem como texto puro numa tela de chat.`

  if (!context) {
    return base
  }

  const daysDescription = context.days
    .map((day) => {
      const exercises = day.exercises
        .map((ex) => `${ex.name} (${ex.targetSets}x${ex.targetReps}${ex.targetRir ? `, RIR ${ex.targetRir}` : ''})`)
        .join('; ')
      const cardio = day.cardio
        ? ` Cardio: ${day.cardio.minutes}min de ${day.cardio.name}${day.cardio.intensity ? `, intensidade ${day.cardio.intensity}` : ''}.`
        : ''
      return `${day.dayLabel}: ${exercises}.${cardio}`
    })
    .join(' | ')

  const contextBlock = `

Contexto real do aluno agora - use isso pra responder de forma específica, não genérica:
Objetivo: ${context.goal}. Nível: ${context.level}. Dias por semana: ${context.daysPerWeek}.
Semana atual do plano: ${context.currentWeek} de 4${context.weekType ? ` (${context.weekType})` : ''}.
Treinos da semana atual: ${daysDescription || 'nenhum treino encontrado'}.`

  return base + contextBlock
}

export async function chatWithCoach(messages: ChatMessage[], context: PlanContext | null): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: 'gpt-5.4-nano',
    messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...messages],
  })

  return completion.choices[0].message.content ?? ''
}
