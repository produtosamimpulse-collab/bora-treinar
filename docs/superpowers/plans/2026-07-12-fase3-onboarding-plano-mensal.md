# Fase 3 — Onboarding + Geração do Primeiro Mês Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboarding conversacional com IA (extrai perfil da pessoa) disparando a geração determinística do primeiro mês de treino (motor de regras: split automático, seleção de exercícios, volume por objetivo), com uma tela simples mostrando o plano gerado.

**Architecture:** Next.js API route de chat (`/api/onboarding/chat`) fala com a OpenAI (tool calling) e, ao extrair o perfil completo, grava `profile` no Supabase e chama o motor de regras (funções TypeScript puras em `lib/plan-engine/`) que grava `training_plan`/`workout_day`/`workout_day_exercise`. Semana 1 do mês 1 é sempre calibração (`target_load_kg = null`, em todas as 4 semanas nesta fase — ver nota abaixo). A função de progressão (que calcularia cargas das semanas 2-4 a partir de dados reais da semana 1) é escrita e testada de forma isolada, mas **não é acionada automaticamente nesta fase**, porque a execução guiada do treino (que produziria esses dados reais) é uma fase futura — sem ela, não existe dado de semana 1 pra progressão nenhuma consumir ainda.

**Tech Stack:** Next.js (App Router), TypeScript, Vitest, Supabase, OpenAI SDK (`openai` — Chat Completions com tool calling).

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — só migrations aditivas via `supabase db push`, nunca `db reset`/`drop`/`truncate`. Toda tabela/coluna nova mantém RLS.
- Cota da ExerciseDB: 690 requisições/mês, ~550 restantes ao final da Fase 2 — a re-sincronização desta fase (Task 1) consome ~130
- IA (`gpt-5.4-nano` via OpenAI) nunca decide o conteúdo do treino diretamente — só conduz a conversa e extrai sinais estruturados via tool calling. O motor de regras (TypeScript puro, testável) é a única camada que decide o treino.
- Nunca chamar a API da OpenAI de dentro de um teste automatizado — sempre mockar (mesma disciplina já aplicada ao cliente da ExerciseDB na Fase 2)
- Paleta visual: fundo claro (`#FFFFFF`), texto preto (`#0A0A0A`), verde-limão (`#C8FF00`) via tokens `bg-background`/`text-foreground`/`bg-brand`/`bg-surface`/`border-border-subtle`, tipografia `font-display` (Anton) para títulos
- **Nunca usar travessão (—) em nenhum texto visível na interface** — usar vírgula, ponto ou reescrever a frase
- Guardrail de segurança: nunca sugerir incremento de carga acima de 5% por semana, mesmo que um cálculo desatento permitisse

---

## Task 1: Adicionar coluna `target` e re-sincronizar exercícios

**Files:**
- Create: `supabase/migrations/20260713000000_add_exercise_target.sql`
- Modify: `lib/exercisedb/map.ts`, `lib/exercisedb/map.test.ts`

**Interfaces:**
- Consumes: `ExerciseDbExercise.target` (já existe no tipo desde a Fase 2, só não era usado)
- Produces: coluna `exercise.target` populada após re-sync; `ExerciseRow` ganha o campo `target`

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260713000000_add_exercise_target.sql`:
```sql
alter table exercise add column target text;
```

- [ ] **Step 2: Aplicar a migration no projeto remoto**

Run:
```bash
npx supabase db push
```
Expected: `Finished supabase db push`. Confirmar (se pedir) — é aditivo, não afeta nenhuma tabela do CRM.

- [ ] **Step 3: Atualizar o teste de mapeamento (falhando)**

Modify `lib/exercisedb/map.test.ts` — adicionar `target` esperado nos dois casos de teste existentes:

```typescript
    expect(mapToExerciseRow(input)).toEqual({
      external_id: '0001',
      name: '3/4 sit-up',
      instructions: 'Step 1\nStep 2',
      muscle_group: 'waist',
      equipment: 'body weight',
      media_url: null,
      target: 'abs',
    })
```
(no segundo teste, adicionar `expect(result.target).toBe('abs')` ao final, mantendo `target: 'abs'` no `input`.)

- [ ] **Step 4: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `mapToExerciseRow` ainda não retorna `target`.

- [ ] **Step 5: Atualizar `lib/exercisedb/map.ts`**

```typescript
import type { ExerciseDbExercise } from './client'

export type ExerciseRow = {
  external_id: string
  name: string
  instructions: string
  muscle_group: string
  equipment: string | null
  media_url: string | null
  target: string
}

export function mapToExerciseRow(exercise: ExerciseDbExercise): ExerciseRow {
  return {
    external_id: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions.join('\n'),
    muscle_group: exercise.bodyPart,
    equipment: exercise.equipment || null,
    media_url: null,
    target: exercise.target,
  }
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260713000000_add_exercise_target.sql lib/exercisedb/map.ts lib/exercisedb/map.test.ts
git commit -m "feat: add target column to exercise table"
```

- [ ] **Step 8: Rodar a re-sincronização real (consome ~130 requisições da cota)**

Run:
```bash
npm run sync:exercises
```
Expected: `Sincronizados 1394 exercícios no Supabase` (ou número próximo, se a ExerciseDB tiver adicionado exercícios). Como é `upsert` em `external_id`, isso só preenche o `target` que faltava — não duplica nada. Se der erro, não rodar de novo sem investigar (mesma disciplina da Fase 2).

- [ ] **Step 9: Verificar que `target` foi preenchido**

Create `lib/exercisedb/target-backfill.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise.target backfill', () => {
  it('has target populated for the vast majority of rows', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT COUNT(*)::int AS total, COUNT(target)::int AS with_target FROM exercise`
    )

    await client.end()

    const { total, with_target } = result.rows[0]
    expect(with_target).toBeGreaterThan(total * 0.95)
  })
})
```

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/exercisedb/target-backfill.test.ts
git commit -m "test: verify target backfill after re-sync"
```

---

## Task 2: Cliente OpenAI com tool calling

**Files:**
- Create: `lib/openai/client.ts`
- Test: `lib/openai/client.test.ts`

**Interfaces:**
- Consumes: `OPENAI_API_KEY` (`.env.local`, já preenchida)
- Produces: `type ChatMessage`, `type OnboardingProfile`, `chatWithTool(messages: ChatMessage[]): Promise<ChatResult>` onde `ChatResult` é `{ type: 'message'; content: string } | { type: 'tool_call'; profile: OnboardingProfile }`

> **Nota de implementação:** instalar o pacote oficial `openai` (`npm install openai`). O modelo `gpt-5.4-nano` é mais recente que minha base de conhecimento — antes de finalizar, confirme na documentação/typings instalados do pacote `openai` que a API usada abaixo (`client.chat.completions.create` com `tools`) ainda é o formato correto para esse modelo; se o SDK expuser uma API diferente (ex: `client.responses.create`), adapte mantendo a mesma assinatura de `chatWithTool` e documente a mudança no relatório, como já foi feito com o Tailwind v4 e o `proxy.ts` na Fase 1.

- [ ] **Step 1: Instalar o SDK da OpenAI**

Run:
```bash
npm install openai
```

- [ ] **Step 2: Escrever o teste do cliente (falhando)**

Create `lib/openai/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { chatWithTool } from './client'

describe('chatWithTool', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a plain message when the model does not call the tool', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Qual seu objetivo?', tool_calls: undefined } }],
    })

    const result = await chatWithTool([{ role: 'user', content: 'Oi' }])

    expect(result).toEqual({ type: 'message', content: 'Qual seu objetivo?' })
  })

  it('returns the extracted profile when the model calls completar_onboarding', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 4,
      equipment: 'academia completa',
      restrictions: null,
    }

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                function: { name: 'completar_onboarding', arguments: JSON.stringify(profile) },
              },
            ],
          },
        },
      ],
    })

    const result = await chatWithTool([{ role: 'user', content: 'Já disse tudo' }])

    expect(result).toEqual({ type: 'tool_call', profile })
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(chatWithTool([{ role: 'user', content: 'Oi' }])).rejects.toThrow(
      'Missing OPENAI_API_KEY'
    )
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/openai/client.ts` não existe.

- [ ] **Step 4: Implementar `lib/openai/client.ts`**

```typescript
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

  if (toolCall) {
    const profile = JSON.parse(toolCall.function.arguments) as OnboardingProfile
    return { type: 'tool_call', profile }
  }

  return { type: 'message', content: message.content ?? '' }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/openai/client.ts lib/openai/client.test.ts package.json package-lock.json
git commit -m "feat: add OpenAI client with onboarding tool calling"
```

---

## Task 3: Motor de regras — seleção de split

**Files:**
- Create: `lib/plan-engine/split.ts`
- Test: `lib/plan-engine/split.test.ts`

**Interfaces:**
- Produces: `type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs'`, `type SplitDay = { label: string; targets: string[] }`, `chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] }`

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/split.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { chooseSplit } from './split'

describe('chooseSplit', () => {
  it('uses full body for 2-3 days per week', () => {
    expect(chooseSplit(2).type).toBe('full_body')
    expect(chooseSplit(3).type).toBe('full_body')
    expect(chooseSplit(3).days).toHaveLength(3)
  })

  it('uses upper/lower for 4 days per week', () => {
    const result = chooseSplit(4)
    expect(result.type).toBe('upper_lower')
    expect(result.days.map((d) => d.label)).toEqual(['Upper', 'Lower', 'Upper', 'Lower'])
  })

  it('uses push/pull/legs for 5-6 days per week', () => {
    const result5 = chooseSplit(5)
    expect(result5.type).toBe('push_pull_legs')
    expect(result5.days.map((d) => d.label)).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull'])

    const result6 = chooseSplit(6)
    expect(result6.days.map((d) => d.label)).toEqual([
      'Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs',
    ])
  })

  it('throws for an out-of-range number of days', () => {
    expect(() => chooseSplit(0)).toThrow()
    expect(() => chooseSplit(8)).toThrow()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/split.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/split.ts`**

```typescript
export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs'

export type SplitDay = {
  label: string
  targets: string[]
}

const FULL_BODY_TARGETS = ['chest', 'back', 'upper legs', 'shoulders', 'abs']
const UPPER_TARGETS = ['chest', 'back', 'shoulders', 'triceps', 'biceps']
const LOWER_TARGETS = ['upper legs', 'lower legs', 'abs']
const PUSH_TARGETS = ['chest', 'shoulders', 'triceps']
const PULL_TARGETS = ['back', 'biceps', 'forearms']
const LEGS_TARGETS = ['upper legs', 'lower legs', 'abs']

export function chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] } {
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  if (daysPerWeek <= 3) {
    const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) => ({
      label: `Full Body ${i + 1}`,
      targets: FULL_BODY_TARGETS,
    }))
    return { type: 'full_body', days }
  }

  if (daysPerWeek === 4) {
    const days: SplitDay[] = [
      { label: 'Upper', targets: UPPER_TARGETS },
      { label: 'Lower', targets: LOWER_TARGETS },
      { label: 'Upper', targets: UPPER_TARGETS },
      { label: 'Lower', targets: LOWER_TARGETS },
    ]
    return { type: 'upper_lower', days }
  }

  const cycle: SplitDay[] = [
    { label: 'Push', targets: PUSH_TARGETS },
    { label: 'Pull', targets: PULL_TARGETS },
    { label: 'Legs', targets: LEGS_TARGETS },
  ]
  const days = Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3])
  return { type: 'push_pull_legs', days }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/split.ts lib/plan-engine/split.test.ts
git commit -m "feat: add workout split selection engine"
```

---

## Task 4: Motor de regras — seleção de exercícios por dia

**Files:**
- Create: `lib/plan-engine/select-exercises.ts`
- Test: `lib/plan-engine/select-exercises.test.ts`

**Interfaces:**
- Consumes: `SplitDay` (Task 3), tabela `exercise` (via `createServerSupabaseClient`)
- Produces: `selectExercisesForDay(supabase, day: SplitDay, equipmentFilter: string | null, count: number): Promise<{ id: string; name: string }[]>`

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/select-exercises.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { selectExercisesForDay } from './select-exercises'

function makeSupabaseMock(rows: { id: string; name: string }[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
  const inFilter = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ in: inFilter })
  const from = vi.fn().mockReturnValue({ select })
  return { from } as never
}

describe('selectExercisesForDay', () => {
  it('queries the exercise table filtering by target and limiting by count', async () => {
    const rows = [
      { id: '1', name: 'Bench Press' },
      { id: '2', name: 'Push-up' },
    ]
    const supabase = makeSupabaseMock(rows)

    const result = await selectExercisesForDay(
      supabase,
      { label: 'Push', targets: ['chest', 'shoulders', 'triceps'] },
      null,
      2
    )

    expect(supabase.from).toHaveBeenCalledWith('exercise')
    expect(result).toEqual(rows)
  })

  it('throws when the query returns an error', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const inFilter = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ in: inFilter })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as never

    await expect(
      selectExercisesForDay(supabase, { label: 'Push', targets: ['chest'] }, null, 5)
    ).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/select-exercises.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/select-exercises.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'

export async function selectExercisesForDay(
  supabase: SupabaseClient,
  day: SplitDay,
  equipmentFilter: string | null,
  count: number
): Promise<{ id: string; name: string }[]> {
  let query = supabase.from('exercise').select('id, name').in('target', day.targets)

  if (equipmentFilter) {
    query = query.eq('equipment', equipmentFilter)
  }

  const { data, error } = await query.limit(count)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/select-exercises.ts lib/plan-engine/select-exercises.test.ts
git commit -m "feat: add exercise selection by split day"
```

---

## Task 5: Motor de regras — geração do plano mensal

**Files:**
- Create: `lib/plan-engine/volume-table.ts`, `lib/plan-engine/generate-month.ts`
- Test: `lib/plan-engine/volume-table.test.ts`, `lib/plan-engine/generate-month.test.ts`

**Interfaces:**
- Consumes: `OnboardingProfile` (Task 2), `chooseSplit` (Task 3), `selectExercisesForDay` (Task 4)
- Produces: `getVolumeForGoal(goal): { sets: number; reps: string; exercisesPerDay: number }`, `generateFirstMonth(supabase, userId: string, profile: OnboardingProfile): Promise<{ trainingPlanId: string }>` — grava `training_plan`, `workout_day` (4 semanas) e `workout_day_exercise` (com `target_load_kg = null` em todas)

> **Nota de escopo (filtro de equipamento):** o design original previa filtrar exercícios pelo `equipment` informado no onboarding. Na prática, `profile.equipment` é texto livre extraído pela IA (ex: "academia completa", "só peso corporal em casa") e não bate com o vocabulário controlado da coluna `exercise.equipment` da ExerciseDB (ex: "body weight", "barbell", "dumbbell", "cable"). Mapear um pra outro exigiria uma tabela de tradução própria, fora do escopo desta fase. Por isso, `generateFirstMonth` abaixo passa `null` como filtro de equipamento (não filtra), selecionando exercícios de todo o catálogo pro grupo muscular do dia, independente do equipamento disponível. Revisitar numa fase futura com uma tabela de mapeamento adequada.

- [ ] **Step 1: Escrever o teste da tabela de volume (falhando)**

Create `lib/plan-engine/volume-table.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getVolumeForGoal } from './volume-table'

describe('getVolumeForGoal', () => {
  it('returns hypertrophy ranges for hipertrofia', () => {
    const volume = getVolumeForGoal('hipertrofia')
    expect(volume.sets).toBe(4)
    expect(volume.reps).toBe('8-12')
    expect(volume.exercisesPerDay).toBeGreaterThan(0)
  })

  it('returns higher reps and shorter rest emphasis for emagrecimento', () => {
    const volume = getVolumeForGoal('emagrecimento')
    expect(volume.reps).toBe('12-15')
  })

  it('returns a conservative default for saude_geral', () => {
    const volume = getVolumeForGoal('saude_geral')
    expect(volume.sets).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/plan-engine/volume-table.ts`**

```typescript
import type { OnboardingProfile } from '../openai/client'

type Volume = {
  sets: number
  reps: string
  exercisesPerDay: number
}

const VOLUME_BY_GOAL: Record<OnboardingProfile['goal'], Volume> = {
  hipertrofia: { sets: 4, reps: '8-12', exercisesPerDay: 6 },
  emagrecimento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  condicionamento: { sets: 3, reps: '12-15', exercisesPerDay: 6 },
  saude_geral: { sets: 3, reps: '10-12', exercisesPerDay: 5 },
}

export function getVolumeForGoal(goal: OnboardingProfile['goal']): Volume {
  return VOLUME_BY_GOAL[goal]
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Escrever o teste da geração do mês (falhando)**

Create `lib/plan-engine/generate-month.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateFirstMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

function makeSupabaseMock() {
  const insertedRows: Record<string, unknown[]> = {}

  function makeTable(name: string) {
    return {
      insert: (rows: unknown[]) => ({
        select: () => ({
          single: async () => {
            const row = { id: `${name}-id`, ...(rows[0] as object) }
            insertedRows[name] = insertedRows[name] ?? []
            insertedRows[name].push(row)
            return { data: row, error: null }
          },
        }),
      }),
      select: () => ({
        in: () => ({
          limit: async () => ({
            data: [
              { id: 'ex-1', name: 'Exercise 1' },
              { id: 'ex-2', name: 'Exercise 2' },
            ],
            error: null,
          }),
        }),
      }),
    }
  }

  const from = vi.fn((name: string) => makeTable(name))
  return { from, insertedRows } as never
}

describe('generateFirstMonth', () => {
  it('creates a training_plan and 4 weeks of workout_day with no prescribed load', async () => {
    const supabase = makeSupabaseMock()
    const profile: OnboardingProfile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }

    const result = await generateFirstMonth(supabase, 'user-1', profile)

    expect(result.trainingPlanId).toBe('training_plan-id')
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/generate-month.ts` não existe.

- [ ] **Step 7: Implementar `lib/plan-engine/generate-month.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { chooseSplit } from './split'
import { selectExercisesForDay } from './select-exercises'
import { getVolumeForGoal } from './volume-table'

export async function generateFirstMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile
): Promise<{ trainingPlanId: string }> {
  const split = chooseSplit(profile.days_per_week)
  const volume = getVolumeForGoal(profile.goal)

  const referenceMonth = new Date()
  referenceMonth.setDate(1)

  const { data: trainingPlan, error: planError } = await supabase
    .from('training_plan')
    .insert([
      {
        user_id: userId,
        reference_month: referenceMonth.toISOString().slice(0, 10),
        goal: profile.goal,
        periodization_phase: 'acumulacao',
      },
    ])
    .select()
    .single()

  if (planError) {
    throw new Error(planError.message)
  }

  for (let week = 1; week <= 4; week++) {
    for (const day of split.days) {
      const { data: workoutDay, error: dayError } = await supabase
        .from('workout_day')
        .insert([
          {
            training_plan_id: trainingPlan.id,
            week_number: week,
            day_label: day.label,
          },
        ])
        .select()
        .single()

      if (dayError) {
        throw new Error(dayError.message)
      }

      const exercises = await selectExercisesForDay(
        supabase,
        day,
        null,
        volume.exercisesPerDay
      )

      const [minReps] = volume.reps.split('-').map(Number)

      const dayExerciseRows = exercises.map((exercise, index) => ({
        workout_day_id: workoutDay.id,
        exercise_id: exercise.id,
        order_index: index,
        target_sets: volume.sets,
        target_reps: minReps,
        target_load_kg: null,
      }))

      const { error: exerciseError } = await supabase
        .from('workout_day_exercise')
        .insert(dayExerciseRows)

      if (exerciseError) {
        throw new Error(exerciseError.message)
      }
    }
  }

  return { trainingPlanId: trainingPlan.id }
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/plan-engine/volume-table.ts lib/plan-engine/volume-table.test.ts lib/plan-engine/generate-month.ts lib/plan-engine/generate-month.test.ts
git commit -m "feat: add first-month plan generation engine"
```

---

## Task 6: Motor de regras — função de progressão (infraestrutura para fase futura)

**Files:**
- Create: `lib/plan-engine/progression.ts`
- Test: `lib/plan-engine/progression.test.ts`

**Interfaces:**
- Produces: `calculateProgressiveLoad(week1LoadKg: number, targetWeek: 2 | 3 | 4): number` — aplica os incrementos definidos no design (5%, 5%, 2.5%), com o guardrail de nunca ultrapassar 5% por semana

> **Nota:** esta função não é chamada por nenhuma rota ainda nesta fase (não há execução guiada de treino pra gerar dados reais de semana 1). É escrita e testada isoladamente agora para não deixar a lógica de progressão sem dono quando a fase de execução guiada precisar dela.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/progression.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateProgressiveLoad } from './progression'

describe('calculateProgressiveLoad', () => {
  it('applies a 5% increase for week 2', () => {
    expect(calculateProgressiveLoad(100, 2)).toBeCloseTo(105)
  })

  it('applies a cumulative 5% increase for week 3', () => {
    expect(calculateProgressiveLoad(100, 3)).toBeCloseTo(110.25)
  })

  it('applies a smaller cumulative increase for week 4', () => {
    expect(calculateProgressiveLoad(100, 4)).toBeCloseTo(113.00625)
  })

  it('never exceeds a 5% single-step increase, even with a tampered rate', () => {
    // guardrail: mesmo que alguém tente passar uma semana inválida, a função
    // nunca deve compor mais de 5% por "passo" de semana.
    const week2 = calculateProgressiveLoad(100, 2)
    expect(week2 / 100).toBeLessThanOrEqual(1.05)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/progression.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/progression.ts`**

```typescript
const WEEKLY_INCREMENTS: Record<2 | 3 | 4, number> = {
  2: 0.05,
  3: 0.05,
  4: 0.025,
}

const MAX_SINGLE_STEP_INCREMENT = 0.05

export function calculateProgressiveLoad(week1LoadKg: number, targetWeek: 2 | 3 | 4): number {
  let load = week1LoadKg

  for (let week = 2; week <= targetWeek; week++) {
    const increment = Math.min(
      WEEKLY_INCREMENTS[week as 2 | 3 | 4],
      MAX_SINGLE_STEP_INCREMENT
    )
    load = load * (1 + increment)
  }

  return load
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/progression.ts lib/plan-engine/progression.test.ts
git commit -m "feat: add progression calculation (unwired, for future guided-execution phase)"
```

---

## Task 7: API route do chat de onboarding

**Files:**
- Create: `app/api/onboarding/chat/route.ts`
- Test: `app/api/onboarding/chat/route.test.ts`

**Interfaces:**
- Consumes: `chatWithTool` (Task 2), `generateFirstMonth` (Task 5), `createServerSupabaseClient` (Fase 1)
- Produces: `POST /api/onboarding/chat` — recebe `{ userId: string; messages: ChatMessage[] }`, retorna `{ type: 'message'; content: string } | { type: 'completed'; trainingPlanId: string }`

- [ ] **Step 1: Escrever o teste da rota (falhando)**

Create `app/api/onboarding/chat/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChatWithTool = vi.fn()
const mockGenerateFirstMonth = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/openai/client', () => ({ chatWithTool: mockChatWithTool }))
vi.mock('@/lib/plan-engine/generate-month', () => ({ generateFirstMonth: mockGenerateFirstMonth }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args)
        return { select: () => ({ single: mockSingle }) }
      },
    }),
  }),
}))

import { POST } from './route'

describe('POST /api/onboarding/chat', () => {
  beforeEach(() => {
    mockChatWithTool.mockReset()
    mockGenerateFirstMonth.mockReset()
    mockInsert.mockReset()
    mockSingle.mockReset()
  })

  it('returns the assistant message when onboarding is not complete', async () => {
    mockChatWithTool.mockResolvedValue({ type: 'message', content: 'Qual seu objetivo?' })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', messages: [{ role: 'user', content: 'Oi' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(body).toEqual({ type: 'message', content: 'Qual seu objetivo?' })
  })

  it('saves the profile and generates the first month when onboarding completes', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
    }
    mockChatWithTool.mockResolvedValue({ type: 'tool_call', profile })
    mockSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null })
    mockGenerateFirstMonth.mockResolvedValue({ trainingPlanId: 'plan-1' })

    const request = new Request('http://localhost/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', messages: [{ role: 'user', content: 'Pronto' }] }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalled()
    expect(mockGenerateFirstMonth).toHaveBeenCalledWith(expect.anything(), 'user-1', profile)
    expect(body).toEqual({ type: 'completed', trainingPlanId: 'plan-1' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `app/api/onboarding/chat/route.ts` não existe.

- [ ] **Step 3: Implementar `app/api/onboarding/chat/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { chatWithTool, type ChatMessage } from '@/lib/openai/client'
import { generateFirstMonth } from '@/lib/plan-engine/generate-month'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { userId, messages } = (await request.json()) as {
    userId: string
    messages: ChatMessage[]
  }

  const result = await chatWithTool(messages)

  if (result.type === 'message') {
    return NextResponse.json({ type: 'message', content: result.content })
  }

  const supabase = createServerSupabaseClient()

  const { data: profileRow, error } = await supabase
    .from('profile')
    .insert([
      {
        user_id: userId,
        goal: result.profile.goal,
        level: result.profile.level,
        days_per_week: result.profile.days_per_week,
        equipment: result.profile.equipment,
        restrictions: result.profile.restrictions,
        onboarding_transcript: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      },
    ])
    .select()
    .single()

  if (error || !profileRow) {
    throw new Error(error?.message ?? 'Failed to save profile')
  }

  const { trainingPlanId } = await generateFirstMonth(supabase, userId, result.profile)

  return NextResponse.json({ type: 'completed', trainingPlanId })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/onboarding/chat/route.ts app/api/onboarding/chat/route.test.ts
git commit -m "feat: add onboarding chat API route"
```

---

## Task 8: Tela de chat de onboarding

**Files:**
- Create: `app/onboarding/page.tsx`
- Modify: `app/page.tsx` (link para `/onboarding`)

**Interfaces:**
- Consumes: `POST /api/onboarding/chat` (Task 7)
- Produces: rota `/onboarding`, redireciona para `/plano?id=<trainingPlanId>` quando a conversa completa

- [ ] **Step 1: Criar `app/onboarding/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type Message = { role: 'user' | 'assistant'; content: string }

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Oi! Vamos montar seu plano. Qual seu objetivo principal com o treino?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function sendMessage() {
    if (!input.trim()) {
      return
    }

    const nextMessages: Message[] = [...messages, { role: 'user', content: input }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    const supabase = createBrowserSupabaseClient()
    const { data: userData } = await supabase.auth.getUser()

    const response = await fetch('/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userData.user?.id, messages: nextMessages }),
    })

    const result = await response.json()
    setLoading(false)

    if (result.type === 'completed') {
      router.push(`/plano?id=${result.trainingPlanId}`)
      return
    }

    setMessages((current) => [...current, { role: 'assistant', content: result.content }])
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-background px-6 py-10 text-foreground">
      <h1 className="mb-6 font-display text-3xl uppercase leading-none tracking-tight">
        Vamos <span className="text-brand">te conhecer</span>
      </h1>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-2xl bg-brand px-4 py-2 text-sm text-black'
                : 'mr-auto max-w-[80%] rounded-2xl border border-border-subtle bg-surface px-4 py-2 text-sm'
            }
          >
            {message.content}
          </div>
        ))}
        {loading && <p className="text-sm text-foreground/50">Digitando...</p>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 rounded-xl border border-border-subtle bg-surface p-3 text-sm focus:border-brand focus:outline-none"
          placeholder="Digite sua resposta"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-brand px-5 text-sm font-semibold uppercase text-black disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Adicionar link na página inicial**

Read `app/page.tsx` primeiro. Adicionar um segundo link/botão pra `/onboarding` (ex: "Começar meu plano"), mantendo o link já existente pra `/exercicios`.

- [ ] **Step 3: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`, com `/onboarding` e `/api/onboarding/chat` listados.

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/page.tsx app/page.tsx
git commit -m "feat: add onboarding chat screen"
```

---

## Task 9: Tela de resultado do plano

**Files:**
- Create: `app/plano/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Fase 1), `?id=<trainingPlanId>` da query string
- Produces: rota `/plano`, lista os `workout_day`/`workout_day_exercise` da semana 1 do plano gerado

- [ ] **Step 1: Criar `app/plano/page.tsx`**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p>Nenhum plano encontrado.</p>
      </main>
    )
  }

  const supabase = createServerSupabaseClient()

  const { data: days } = await supabase
    .from('workout_day')
    .select('id, day_label, week_number, workout_day_exercise(id, target_sets, target_reps, exercise(name))')
    .eq('training_plan_id', id)
    .eq('week_number', 1)
    .order('id')

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Semana 1, calibração
        </span>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          Seu <span className="text-brand">plano</span>
        </h1>
      </header>

      {(days ?? []).map((day) => (
        <section key={day.id} className="mb-8 rounded-2xl border border-border-subtle bg-surface p-6">
          <h2 className="mb-4 font-display text-2xl uppercase">{day.day_label}</h2>
          <ul className="space-y-2">
            {(day.workout_day_exercise as unknown as Array<{
              id: string
              target_sets: number
              target_reps: number
              exercise: { name: string }
            }>).map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>{item.exercise.name}</span>
                <span className="text-foreground/60">
                  {item.target_sets}x{item.target_reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
```

- [ ] **Step 2: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`, com `/plano` listado.

- [ ] **Step 3: Commit**

```bash
git add app/plano/page.tsx
git commit -m "feat: add generated plan result page"
```

---

## Fim da Fase 3

Ao final desta fase: `/onboarding` conduz uma conversa real com a IA, extrai o perfil, e ao completar gera o primeiro mês de treino (4 semanas, split automático conforme dias disponíveis, exercícios reais do catálogo, semana 1 sem carga prescrita). `/plano` mostra o resultado. A função de progressão existe e está testada, pronta para ser acionada quando a fase de execução guiada do treino existir.
