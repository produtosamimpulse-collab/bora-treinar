import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatMessage } from './client'
import type { CatalogOption, RebuildError, RebuiltDay } from '../plan-engine/rebuild-day'
import { MUSCLE_GROUPS, BEACH_QUALITIES } from '../plan-engine/movement-catalog'

export type PlanDay = {
  workoutDayId: string
  weekNumber: number
  weekdayName: string
  dayLabel: string
  completed: boolean
  isCurrentWeek: boolean
  exercises: string[]
}

export type PlanContext = {
  goal: string
  level: string
  daysPerWeek: number
  monthNumber: number
  currentWeek: number
  weekType: string | null
  days: PlanDay[]
}

export type PlanTools = {
  searchExercises: (criteria: {
    groups?: string[]
    nameQuery?: string
    beach?: string[]
  }) => Promise<CatalogOption[]>
  rebuildDay: (
    workoutDayId: string,
    input: { exerciseIds: string[]; dayLabel?: string }
  ) => Promise<RebuiltDay | RebuildError>
}

export type PlanChatResult = {
  content: string
  rebuiltDayIds: string[]
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_exercicios',
      description:
        'Busca movimentos tradicionais de academia disponíveis, por grupo muscular, por nome, ou por qualidade física do beach tennis. Use antes de refazer qualquer dia.',
      parameters: {
        type: 'object',
        properties: {
          grupos_musculares: { type: 'array', items: { type: 'string', enum: [...MUSCLE_GROUPS] } },
          nome: { type: 'string', description: 'Trecho do nome do exercício (ex: "leg press", "stiff")' },
          foco_beach_tennis: {
            type: 'array',
            items: { type: 'string', enum: [...BEACH_QUALITIES] },
            description:
              'Qualidades do beach tennis: potencia_salto, core_rotacional, ombro_estavel, tornozelo_panturrilha, preensao',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refazer_treino_do_dia',
      description:
        'Substitui todos os exercícios de UM dia do plano. Escolha o workout_day_id na lista de dias do contexto. Dia já concluído não pode ser refeito. Pode ser chamada mais de uma vez pra reorganizar vários dias da semana.',
      parameters: {
        type: 'object',
        properties: {
          workout_day_id: { type: 'string', description: 'ID do dia do plano, vindo do contexto' },
          exercicio_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs vindos de buscar_exercicios, de 1 a 10, composto antes de isolado',
          },
          titulo_do_dia: { type: 'string', description: 'Nome curto do dia, em português' },
        },
        required: ['workout_day_id', 'exercicio_ids', 'titulo_do_dia'],
      },
    },
  },
]

function buildSystemPrompt(context: PlanContext | null): string {
  const base = `Você é um Personal Trainer especializado em fisiologia do exercício, periodização e prescrição baseada em evidências. Aqui você conversa com o aluno sobre o MÊS de treino dele como um todo, não sobre um exercício isolado.

O que você faz nessa conversa: explicar como o mês está organizado (divisão dos dias, volume por grupo muscular, semana de calibração e de deload) e reorganizar os dias quando o aluno pedir. Você enxerga todos os dias do plano e pode refazer qualquer um deles que ainda não tenha sido treinado, chamando refazer_treino_do_dia com o workout_day_id daquele dia. Pra reorganizar a semana inteira, chame a ferramenta uma vez por dia.

Você nunca inventa exercício: todo exercício vem de buscar_exercicios, que só devolve movimento tradicional de academia. Séries, repetições e RIR não são escolha sua, continuam vindo do motor do plano pelo objetivo e nível do aluno.

Se o aluno pedir algo que desequilibra o mês (ex: três dias seguidos do mesmo grupo, ou tirar pernas do mês inteiro), monte o que ele pediu e diga em uma frase o que isso custa. Quem decide é ele.

Dia já concluído não pode ser mexido: a ferramenta recusa e o histórico de cargas daquele treino continua valendo.

Responda sempre em português do Brasil, direto e objetivo. Nunca use markdown (nada de **negrito**, listas com hífen, títulos com #), suas respostas aparecem como texto puro numa tela de chat. Nunca escreva um ID na resposta, fale dos dias pelo dia da semana e pelo nome.`

  if (!context) {
    return base
  }

  const daysDescription = context.days
    .map((day) => {
      const status = day.completed ? 'já treinado' : 'em aberto'
      const exercises = day.exercises.length > 0 ? `: ${day.exercises.join(', ')}` : ''
      return `[id: ${day.workoutDayId}] semana ${day.weekNumber}, ${day.weekdayName}, ${day.dayLabel} (${status})${exercises}`
    })
    .join(' | ')

  return `${base}

Contexto real do aluno agora:
Objetivo: ${context.goal}. Nível: ${context.level}. Treina ${context.daysPerWeek}x por semana.
Mês ${context.monthNumber} do plano, semana atual ${context.currentWeek} de 4${context.weekType ? ` (${context.weekType})` : ''}.
Dias do mês: ${daysDescription || 'nenhum dia encontrado'}.
Grupos musculares que as ferramentas aceitam: ${MUSCLE_GROUPS.join(', ')}.`
}

export async function chatWithPlanCoach(
  messages: ChatMessage[],
  context: PlanContext | null,
  tools: PlanTools
): Promise<PlanChatResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const client = new OpenAI({ apiKey })

  const conversation: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages,
  ]

  const rebuiltDayIds: string[] = []

  // Mais voltas que o chat de um dia só: reorganizar a semana inteira são
  // várias chamadas de ferramenta em sequência (uma busca e um refazer por dia).
  for (let iteration = 0; iteration < 8; iteration++) {
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      messages: conversation,
      tools: TOOLS,
    })

    const message = completion.choices[0].message
    const toolCalls = message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      return { content: message.content ?? '', rebuiltDayIds }
    }

    conversation.push(message)

    for (const toolCall of toolCalls) {
      if (!('function' in toolCall)) continue

      const args = JSON.parse(toolCall.function.arguments) as {
        grupos_musculares?: string[]
        nome?: string
        foco_beach_tennis?: string[]
        workout_day_id?: string
        exercicio_ids?: string[]
        titulo_do_dia?: string
      }
      let result: unknown

      if (toolCall.function.name === 'buscar_exercicios') {
        result = await tools.searchExercises({
          groups: args.grupos_musculares,
          nameQuery: args.nome,
          beach: args.foco_beach_tennis,
        })
      } else if (toolCall.function.name === 'refazer_treino_do_dia') {
        const dayId = args.workout_day_id ?? ''
        const rebuildResult = await tools.rebuildDay(dayId, {
          exerciseIds: args.exercicio_ids ?? [],
          dayLabel: args.titulo_do_dia,
        })
        result = rebuildResult

        if (!('error' in rebuildResult)) {
          rebuiltDayIds.push(dayId)
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
    content: 'Consegui mexer no que deu, mas não terminei de organizar tudo. Pode pedir de novo?',
    rebuiltDayIds,
  }
}
