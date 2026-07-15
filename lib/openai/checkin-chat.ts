import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatMessage } from './client'

export type CheckinContext = {
  goal: string
  level: string
  monthNumber: number
}

export type FinalizeCheckinArgs = {
  weightKg: number | null
  painSignal: boolean
  motivationLevel: number | null
  difficultyLevel: number | null
  adjustmentDecision: string
  conversationSummary: string
  measurements: Record<string, number> | null
}

export type FinalizeCheckinResult = { trainingPlanId: string } | { error: string }

export type CheckinTools = {
  finalizeCheckin: (args: FinalizeCheckinArgs) => Promise<FinalizeCheckinResult>
}

export type CheckinChatResult = {
  content: string
  completed: boolean
  trainingPlanId: string | null
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'finalizar_checkin',
      description:
        'Registra a avaliação mensal do aluno (peso, sensações, medidas) e gera o plano do próximo mês com base nisso. Só chame depois de ter coletado peso atual, como o aluno está se sentindo (motivação e dificuldade do mês, de 1 a 5), se há alguma dor ou desconforto, e as medidas corporais que o aluno quiser informar (cintura, quadril, braço, coxa, peito - todas opcionais, em cm).',
      parameters: {
        type: 'object',
        properties: {
          peso_kg: { type: ['number', 'null'], description: 'Peso atual em kg, ou null se não informado' },
          sinal_de_dor: { type: 'boolean', description: 'Se o aluno relatou alguma dor ou desconforto relevante' },
          nivel_motivacao: {
            type: ['integer', 'null'],
            description: 'De 1 (muito desmotivado) a 5 (muito motivado), ou null se não foi possível avaliar',
          },
          nivel_dificuldade: {
            type: ['integer', 'null'],
            description: 'De 1 (muito fácil) a 5 (muito difícil) o quanto o mês foi desafiador, ou null se não avaliado',
          },
          medidas: {
            type: ['object', 'null'],
            description: 'Mapa de medida em cm por parte do corpo informada, ex: {"cintura": 82, "braco": 34}',
          },
          decisao_de_ajuste: {
            type: 'string',
            description:
              'Sua decisão como treinador sobre como ajustar o próximo mês (ex: manter progressão normal, reduzir volume por baixa recuperação, priorizar técnica por relato de dor)',
          },
          resumo_da_conversa: {
            type: 'string',
            description: 'Resumo curto em português da conversa e do estado do aluno, pra ficar no histórico',
          },
        },
        required: ['sinal_de_dor', 'decisao_de_ajuste', 'resumo_da_conversa'],
      },
    },
  },
]

function buildSystemPrompt(context: CheckinContext | null): string {
  const base = `Você é um Personal Trainer especializado em fisiologia do exercício, com formação em periodização de treinamento, biomecânica e prescrição de exercícios baseada em evidências.

Seu papel agora é conduzir a avaliação de fim de mês com o aluno, antes de planejar o próximo mês de treino. Converse de forma natural e objetiva pra coletar: o peso atual do aluno, como ele está se sentindo em relação ao treino (motivação e dificuldade do mês, numa escala de 1 a 5), se sentiu alguma dor ou desconforto relevante, e, se ele quiser, medidas corporais (cintura, quadril, braço, coxa, peito, em cm - deixe claro que são opcionais).

Não precisa fazer uma pergunta de cada vez de forma robótica, mas também não avance pro próximo mês sem ter pelo menos uma ideia de como o aluno está se sentindo. Depois de reunir essas informações, chame a ferramenta finalizar_checkin com sua avaliação e decisão sobre como ajustar o próximo mês - isso já vai gerar o plano automaticamente, então só chame quando tiver certeza de que coletou o essencial.

Segurança: nunca dê conselho médico. Se o aluno relatar dor que pareça além de desconforto muscular normal, oriente a procurar avaliação profissional e registre isso no sinal_de_dor e na decisão de ajuste.

Responda sempre em português do Brasil, de forma direta e acolhedora. Nunca use markdown (nada de **negrito**, listas com hífen, títulos com #) - suas respostas aparecem como texto puro numa tela de chat.`

  if (!context) {
    return base
  }

  return (
    base +
    `\n\nContexto real do aluno agora: objetivo ${context.goal}, nível ${context.level}, terminando o mês ${context.monthNumber}.`
  )
}

export async function chatWithCheckin(
  messages: ChatMessage[],
  context: CheckinContext | null,
  tools: CheckinTools
): Promise<CheckinChatResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const client = new OpenAI({ apiKey })

  const conversation: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages,
  ]

  let completed = false
  let trainingPlanId: string | null = null

  for (let iteration = 0; iteration < 4; iteration++) {
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      messages: conversation,
      tools: TOOLS,
    })

    const message = completion.choices[0].message
    const toolCalls = message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      return { content: message.content ?? '', completed, trainingPlanId }
    }

    conversation.push(message)

    for (const toolCall of toolCalls) {
      if (!('function' in toolCall)) {
        continue
      }

      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
      let result: unknown

      if (toolCall.function.name === 'finalizar_checkin') {
        const finalizeResult = await tools.finalizeCheckin({
          weightKg: (args.peso_kg as number | null) ?? null,
          painSignal: Boolean(args.sinal_de_dor),
          motivationLevel: (args.nivel_motivacao as number | null) ?? null,
          difficultyLevel: (args.nivel_dificuldade as number | null) ?? null,
          adjustmentDecision: String(args.decisao_de_ajuste ?? ''),
          conversationSummary: String(args.resumo_da_conversa ?? ''),
          measurements: (args.medidas as Record<string, number> | null) ?? null,
        })
        result = finalizeResult

        if (!('error' in finalizeResult)) {
          completed = true
          trainingPlanId = finalizeResult.trainingPlanId
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
    content: 'Desculpa, não consegui terminar a avaliação agora. Pode tentar de novo?',
    completed,
    trainingPlanId,
  }
}
