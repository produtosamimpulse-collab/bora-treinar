import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatMessage } from './client'
import type { SwapOption } from '../plan-engine/exercise-swap'

export type DayContext = {
  goal: string
  level: string
  dayLabel: string
  exercises: Array<{
    workoutDayExerciseId: string
    name: string
    targetSets: number
    targetReps: number
    targetRir: string | null
  }>
}

export type SwapToolResult = { id: string; name: string; name_pt: string | null } | { error: string }

export type CoachTools = {
  listAlternatives: (workoutDayExerciseId: string) => Promise<SwapOption[] | null>
  applySwap: (workoutDayExerciseId: string, exerciseId: string) => Promise<SwapToolResult>
}

export type CoachChatResult = {
  content: string
  swapped: { workoutDayExerciseId: string; id: string; name: string } | null
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'listar_alternativas',
      description:
        'Lista até 5 exercícios alternativos pro mesmo grupo muscular de um exercício do treino do dia. Use quando a pessoa relatar dor, desconforto, ou que o equipamento necessário está ocupado.',
      parameters: {
        type: 'object',
        properties: {
          workout_day_exercise_id: {
            type: 'string',
            description: 'ID do exercício do treino a ser trocado (veja o contexto do dia)',
          },
        },
        required: ['workout_day_exercise_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trocar_exercicio',
      description:
        'Troca de fato um exercício do treino do dia por uma das alternativas retornadas por listar_alternativas. Só chame depois de ter visto as alternativas e escolhido uma que faça sentido pro que a pessoa relatou (ex: evitar padrão de movimento que dói).',
      parameters: {
        type: 'object',
        properties: {
          workout_day_exercise_id: { type: 'string' },
          novo_exercicio_id: {
            type: 'string',
            description: 'ID do exercício escolhido, deve ser um dos IDs retornados por listar_alternativas',
          },
        },
        required: ['workout_day_exercise_id', 'novo_exercicio_id'],
      },
    },
  },
]

function buildSystemPrompt(context: DayContext | null): string {
  const base = `Você é um Personal Trainer especializado em fisiologia do exercício, com formação em periodização de treinamento, biomecânica e prescrição de exercícios baseada em evidências.

Seu papel aqui é conversar com o aluno sobre o treino de UM dia específico do plano que o motor de regras do app já montou. Você não decide o conteúdo do treino por conta própria: pode explicar o porquê de exercícios, séries, repetições e RIR; dar dicas de execução e técnica; motivar; e, quando a pessoa relatar dor, desconforto num movimento específico, ou que o equipamento necessário está ocupado, você PODE trocar um exercício de verdade, mas só usando as ferramentas disponíveis - primeiro chame listar_alternativas pra ver as opções realmente disponíveis pro mesmo grupo muscular (você nunca inventa um exercício de cabeça), escolha a que fizer mais sentido pro que foi relatado, e só então chame trocar_exercicio com o ID escolhido.

Segurança: nunca dê conselho médico. Se a dor parecer algo além de desconforto muscular normal (dor aguda, articular, que piora com o movimento), oriente a pessoa a parar esse exercício e procurar avaliação profissional, e ofereça trocar o exercício enquanto isso.

Responda sempre em português do Brasil, de forma direta e objetiva. Nunca use markdown (nada de **negrito**, listas com hífen, títulos com #) - suas respostas aparecem como texto puro numa tela de chat.`

  if (!context) {
    return base
  }

  const exercisesDescription = context.exercises
    .map(
      (ex) =>
        `[id: ${ex.workoutDayExerciseId}] ${ex.name} (${ex.targetSets}x${ex.targetReps}${ex.targetRir ? `, RIR ${ex.targetRir}` : ''})`
    )
    .join(' | ')

  const contextBlock = `

Contexto real do aluno agora:
Objetivo: ${context.goal}. Nível: ${context.level}.
Treino de hoje (${context.dayLabel}): ${exercisesDescription || 'nenhum exercício encontrado'}.`

  return base + contextBlock
}

export async function chatWithCoach(
  messages: ChatMessage[],
  context: DayContext | null,
  tools: CoachTools
): Promise<CoachChatResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const client = new OpenAI({ apiKey })

  const conversation: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages,
  ]

  let swapped: { workoutDayExerciseId: string; id: string; name: string } | null = null

  for (let iteration = 0; iteration < 4; iteration++) {
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      messages: conversation,
      tools: TOOLS,
    })

    const message = completion.choices[0].message
    const toolCalls = message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      return { content: message.content ?? '', swapped }
    }

    conversation.push(message)

    for (const toolCall of toolCalls) {
      if (!('function' in toolCall)) {
        continue
      }

      const args = JSON.parse(toolCall.function.arguments) as Record<string, string>
      let result: unknown

      if (toolCall.function.name === 'listar_alternativas') {
        result = await tools.listAlternatives(args.workout_day_exercise_id)
      } else if (toolCall.function.name === 'trocar_exercicio') {
        const swapResult = await tools.applySwap(args.workout_day_exercise_id, args.novo_exercicio_id)
        result = swapResult

        if (!('error' in swapResult)) {
          swapped = {
            workoutDayExerciseId: args.workout_day_exercise_id,
            id: swapResult.id,
            name: swapResult.name_pt ?? swapResult.name,
          }
        }
      } else {
        result = { error: 'unknown tool' }
      }

      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    content: 'Desculpa, não consegui terminar de resolver isso agora. Pode tentar perguntar de novo?',
    swapped,
  }
}
