import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ChatMessage } from './client'
import type { SwapOption } from '../plan-engine/exercise-swap'
import type { CatalogOption, RebuildError, RebuiltDay } from '../plan-engine/rebuild-day'
import { MUSCLE_GROUPS, BEACH_QUALITIES } from '../plan-engine/movement-catalog'

export type DayContext = {
  goal: string
  level: string
  dayLabel: string
  exercisesPerDay: number
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
  searchExercises: (criteria: {
    groups?: string[]
    nameQuery?: string
    beach?: string[]
  }) => Promise<CatalogOption[]>
  rebuildDay: (input: { exerciseIds: string[]; dayLabel?: string }) => Promise<RebuiltDay | RebuildError>
}

export type CoachChatResult = {
  content: string
  swapped: { workoutDayExerciseId: string; id: string; name: string } | null
  rebuilt: RebuiltDay | null
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
  {
    type: 'function',
    function: {
      name: 'buscar_exercicios',
      description:
        'Busca exercícios disponíveis no catálogo, por grupo muscular e/ou por nome. Use antes de refazer_treino_do_dia, sempre que o aluno pedir um treino diferente do que está prescrito (ex: "hoje quero só posterior", "quero um treino de peito", "coloca stiff e mesa flexora"). Devolve os IDs reais que refazer_treino_do_dia aceita.',
      parameters: {
        type: 'object',
        properties: {
          grupos_musculares: {
            type: 'array',
            items: { type: 'string', enum: [...MUSCLE_GROUPS] },
            description: 'Grupos musculares desejados',
          },
          nome: {
            type: 'string',
            description:
              'Trecho do nome do exercício, quando o aluno pedir um exercício específico (ex: "stiff", "leg press", "remada")',
          },
          foco_beach_tennis: {
            type: 'array',
            items: { type: 'string', enum: [...BEACH_QUALITIES] },
            description:
              'Qualidades físicas do beach tennis, quando o aluno pedir treino pro beach: potencia_salto (arranque e salto na areia), core_rotacional (giro pra bater), ombro_estavel (saque e smash), tornozelo_panturrilha (piso instável), preensao (raquete)',
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
        'Substitui TODOS os exercícios do treino desse dia pelos exercícios escolhidos. Use quando o aluno não gostar do treino do dia ou quiser treinar outra coisa (ex: "não quero pernas hoje, quero só posterior"). Só chame com IDs vindos de buscar_exercicios. Séries, repetições e RIR continuam sendo definidos pelo plano do aluno - você escolhe só quais exercícios entram e em que ordem.',
      parameters: {
        type: 'object',
        properties: {
          exercicio_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
              'IDs dos exercícios do novo treino, vindos de buscar_exercicios. De 1 a 10 exercícios; sem pedido diferente do aluno, use a mesma quantidade que o treino do dia já tinha.',
          },
          titulo_do_dia: {
            type: 'string',
            description:
              'Novo nome curto do dia, em português, refletindo o que passou a ser treinado (ex: "Posterior e Glúteos")',
          },
        },
        required: ['exercicio_ids', 'titulo_do_dia'],
      },
    },
  },
]

function buildSystemPrompt(context: DayContext | null): string {
  const base = `Você é um Personal Trainer especializado em fisiologia do exercício, com formação em periodização de treinamento, biomecânica e prescrição de exercícios baseada em evidências.

Seu papel aqui é conversar com o aluno sobre o treino de UM dia específico do plano e, quando ele pedir, mudar esse treino de verdade. Você pode explicar o porquê de exercícios, séries, repetições e RIR; dar dicas de execução e técnica; e motivar.

Você tem duas formas de mexer no treino, e nunca inventa exercício de cabeça - todo exercício vem das ferramentas:

1. Trocar UM exercício, mantendo o resto do treino. Use quando a pessoa relatar dor num movimento específico ou que o aparelho está ocupado. Chame listar_alternativas pra ver as opções do mesmo grupo muscular e depois trocar_exercicio com o ID escolhido.

2. Refazer o treino do dia INTEIRO. Use quando a pessoa não gostar do treino do dia ou quiser treinar outra coisa ("hoje era pernas mas eu quero só posterior", "quero um treino de peito e tríceps", "monta um treino só de glúteo"). Chame buscar_exercicios com os grupos musculares (e/ou o nome, se ela pediu exercício específico), escolha os exercícios que fazem sentido pro que ela pediu e chame refazer_treino_do_dia com os IDs e um título curto pro dia. Monte na ordem certa: exercícios compostos e mais pesados primeiro, isolados depois. Sem pedido diferente, mantenha a mesma quantidade de exercícios que o dia já tinha.

Treino pro beach tennis: quando o aluno pedir um treino pro beach (ou falar de areia, saque, smash, salto, giro pra bater), chame buscar_exercicios com foco_beach_tennis nas qualidades que fazem sentido pro que ele falou, e monte o dia com isso. As qualidades são potencia_salto, core_rotacional, ombro_estavel, tornozelo_panturrilha e preensao. Um dia bom pro beach costuma juntar uma de potência de perna, uma de core rotacional e uma de ombro. É treino de academia com barra e máquina, não é treino na areia.

Quem manda no que treinar é o aluno: se ele pedir um treino de um grupo só, monte esse treino. Séries, repetições e RIR não são escolha sua nem dele nessa conversa - continuam vindo do plano, calculados pelo objetivo e nível. Se o pedido tiver algum risco (ex: treinar de novo, pesado, um grupo que ele acabou de treinar ontem), monte o que ele pediu e comente o risco em uma frase, sem dar sermão.

Depois de refazer o treino, diga em uma ou duas frases o que ficou, listando os exercícios em texto corrido.

Segurança: nunca dê conselho médico. Se a dor parecer algo além de desconforto muscular normal (dor aguda, articular, que piora com o movimento), oriente a pessoa a parar esse exercício e procurar avaliação profissional, e ofereça trocar o exercício enquanto isso.

Os IDs de exercício (workout_day_exercise_id, novo_exercicio_id) são só pra você usar internamente ao chamar as ferramentas - nunca escreva um ID na sua resposta pro aluno, refira-se aos exercícios sempre pelo nome.

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

  const groupsDescription = MUSCLE_GROUPS.join(', ')

  const contextBlock = `

Contexto real do aluno agora:
Objetivo: ${context.goal}. Nível: ${context.level}.
Treino de hoje (${context.dayLabel}): ${exercisesDescription || 'nenhum exercício encontrado'}.
O plano dele usa ${context.exercisesPerDay} exercícios por dia.
Grupos musculares que as ferramentas aceitam: ${groupsDescription}.`

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
  let rebuilt: RebuiltDay | null = null

  for (let iteration = 0; iteration < 5; iteration++) {
    const completion = await client.chat.completions.create({
      model: 'gpt-5.4-nano',
      messages: conversation,
      tools: TOOLS,
    })

    const message = completion.choices[0].message
    const toolCalls = message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      return { content: message.content ?? '', swapped, rebuilt }
    }

    conversation.push(message)

    for (const toolCall of toolCalls) {
      if (!('function' in toolCall)) {
        continue
      }

      const args = JSON.parse(toolCall.function.arguments) as {
        workout_day_exercise_id?: string
        novo_exercicio_id?: string
        grupos_musculares?: string[]
        nome?: string
        foco_beach_tennis?: string[]
        exercicio_ids?: string[]
        titulo_do_dia?: string
      }
      let result: unknown

      if (toolCall.function.name === 'listar_alternativas') {
        result = await tools.listAlternatives(args.workout_day_exercise_id ?? '')
      } else if (toolCall.function.name === 'trocar_exercicio') {
        const swapResult = await tools.applySwap(
          args.workout_day_exercise_id ?? '',
          args.novo_exercicio_id ?? ''
        )
        result = swapResult

        if (!('error' in swapResult)) {
          swapped = {
            workoutDayExerciseId: args.workout_day_exercise_id ?? '',
            id: swapResult.id,
            name: swapResult.name_pt ?? swapResult.name,
          }
        }
      } else if (toolCall.function.name === 'buscar_exercicios') {
        result = await tools.searchExercises({
          groups: args.grupos_musculares,
          nameQuery: args.nome,
          beach: args.foco_beach_tennis,
        })
      } else if (toolCall.function.name === 'refazer_treino_do_dia') {
        const rebuildResult = await tools.rebuildDay({
          exerciseIds: args.exercicio_ids ?? [],
          dayLabel: args.titulo_do_dia,
        })
        result = rebuildResult

        if (!('error' in rebuildResult)) {
          rebuilt = rebuildResult
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
    rebuilt,
  }
}
