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
}

export type ChatResult =
  | { type: 'message'; content: string }
  | { type: 'tool_call'; profile: OnboardingProfile }

const SYSTEM_PROMPT = `Você é um personal trainer conduzindo a entrevista inicial (onboarding) de um novo aluno no app Bora Treinar!. Converse naturalmente para descobrir: objetivo (emagrecimento, hipertrofia, condicionamento ou saude_geral), nível (iniciante, intermediario ou avancado), quantos dias por semana a pessoa pode treinar, que equipamento/local ela tem disponível, e se há alguma restrição ou lesão. Quando tiver todas essas informações, chame a função completar_onboarding. Nunca decida o treino em si, isso é papel de outro sistema.`

const TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'completar_onboarding',
    description: 'Chame quando tiver objetivo, nível, dias por semana, equipamento e restrições da pessoa.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', enum: ['emagrecimento', 'hipertrofia', 'condicionamento', 'saude_geral'] },
        level: { type: 'string', enum: ['iniciante', 'intermediario', 'avancado'] },
        days_per_week: { type: 'integer', minimum: 1, maximum: 7 },
        equipment: { type: 'string' },
        restrictions: { type: ['string', 'null'] },
      },
      required: ['goal', 'level', 'days_per_week', 'equipment', 'restrictions'],
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
