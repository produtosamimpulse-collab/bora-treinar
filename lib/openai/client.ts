import OpenAI from 'openai'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type OnboardingProfile = {
  goal: 'emagrecimento' | 'hipertrofia' | 'condicionamento' | 'saude_geral'
  level: 'iniciante' | 'intermediario' | 'avancado'
  days_per_week: number
  equipment: string
  restrictions: string | null
  session_minutes: number
  age: number
  sex: 'masculino' | 'feminino' | 'outro'
  training_history: string | null
  excluded_targets: string[]
}

export type ChatResult =
  | { type: 'message'; content: string }
  | { type: 'tool_call'; profile: OnboardingProfile }

const SYSTEM_PROMPT = `Você é um personal trainer conduzindo a entrevista inicial (onboarding) de um novo aluno no app Bora Treinar!. Converse naturalmente, mas pergunte EXPLICITAMENTE e confirme cada um destes pontos antes de chamar a função completar_onboarding, nunca decida um valor sem a pessoa ter respondido: objetivo (emagrecimento, hipertrofia, condicionamento ou saude_geral), nível (iniciante, intermediario ou avancado), quantos dias por semana pode treinar, quanto tempo tem disponível por sessão (em minutos), idade, sexo, um breve histórico de treino anterior, equipamento/local disponível, e se há alguma restrição física ou lesão. Se a pessoa relatar uma restrição ou lesão, traduza-a para uma lista de grupos musculares a evitar usando estritamente estes valores: pectorals, lats, upper back, delts, triceps, biceps, traps, quads, hamstrings, glutes, calves, abs, adductors, abductors, forearms, spine. Se não houver restrição, envie uma lista vazia. Nunca decida o treino em si, isso é papel de outro sistema. Suas mensagens são exibidas como texto puro, sem nenhuma formatação: nunca use markdown (nada de **negrito**, listas com hífen, títulos com #, ou qualquer símbolo de formatação), escreva sempre em texto corrido normal.`

const TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'completar_onboarding',
    description: 'Chame quando tiver objetivo, nível, dias por semana, tempo por sessão, idade, sexo, histórico, equipamento e restrições da pessoa.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', enum: ['emagrecimento', 'hipertrofia', 'condicionamento', 'saude_geral'] },
        level: { type: 'string', enum: ['iniciante', 'intermediario', 'avancado'] },
        days_per_week: { type: 'integer', minimum: 1, maximum: 7 },
        equipment: { type: 'string' },
        restrictions: { type: ['string', 'null'] },
        session_minutes: { type: 'integer', minimum: 10, maximum: 240 },
        age: { type: 'integer', minimum: 13, maximum: 100 },
        sex: { type: 'string', enum: ['masculino', 'feminino', 'outro'] },
        training_history: { type: ['string', 'null'] },
        excluded_targets: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'goal',
        'level',
        'days_per_week',
        'equipment',
        'restrictions',
        'session_minutes',
        'age',
        'sex',
        'training_history',
        'excluded_targets',
      ],
    },
  },
}

export async function chatWithTool(messages: ChatMessage[]): Promise<ChatResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: 'gpt-5.4-nano',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    tools: [TOOL_DEFINITION],
  })

  const message = completion.choices[0].message
  const toolCall = message.tool_calls?.[0]

  if (toolCall && 'function' in toolCall) {
    const profile = JSON.parse(toolCall.function.arguments) as OnboardingProfile
    return { type: 'tool_call', profile }
  }

  return { type: 'message', content: message.content ?? '' }
}
