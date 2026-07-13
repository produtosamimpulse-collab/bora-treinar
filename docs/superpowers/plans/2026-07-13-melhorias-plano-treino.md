# Melhorias no Plano de Treino Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de ver a Fase 3 rodando, o usuário pediu melhorias diretas na tela `/plano`: dia da semana em cada treino, tudo em português (nomes/instruções dos exercícios vêm em inglês da ExerciseDB), imagem de demonstração de cada exercício, um jeito de marcar o treino do dia como concluído, e a tela reorganizada em acordeão por dia da semana.

**Architecture:** Migration adicionando colunas de tradução (`name_pt`, `muscle_group_pt`, `instructions_pt`) na tabela `exercise` e `day_of_week` em `workout_day`. Script de tradução em lote via OpenAI (reaproveita o cliente já existente em `lib/openai/`). Rota de imagem sob demanda que busca da ExerciseDB na primeira vez e cacheia permanentemente no Supabase Storage (a ideia documentada desde a Fase 2, agora implementada). Nova rota de "marcar treino concluído" gravando em `workout_session` (tabela já existe desde a Fase 1). A página `/plano` vira um server component que busca os dados e passa pra um client component com o acordeão interativo.

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — só migrations aditivas via `supabase db push`, nunca `db reset`/`drop`/`truncate`
- Cota da ExerciseDB: 690 requisições/mês. A rota de imagem sob demanda busca cada GIF **no máximo uma vez por exercício** (depois fica cacheado no Storage permanentemente) — nunca re-buscar um `media_url` já preenchido
- Tradução em lote via OpenAI: agrupar vários exercícios por chamada (não uma chamada por exercício) pra manter o custo baixo
- **Nunca usar travessão (—) em nenhum texto visível na interface**
- Paleta visual: `bg-background`/`text-foreground`/`bg-brand`/`bg-surface`/`border-border-subtle`/`font-display`, reaproveitando o que já existe
- A IA nunca decide o conteúdo do treino — a tradução é só localização de texto de exibição, não afeta a lógica do motor de regras

---

## Task 1: Migration — colunas de tradução e dia da semana

**Files:**
- Create: `supabase/migrations/20260713010000_add_translation_and_weekday.sql`

**Interfaces:**
- Produces: `exercise.name_pt`, `exercise.muscle_group_pt`, `exercise.instructions_pt` (todas `text`, nullable); `workout_day.day_of_week` (`smallint`, nullable, 1=segunda a 7=domingo, padrão ISO)

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260713010000_add_translation_and_weekday.sql`:
```sql
alter table exercise add column name_pt text;
alter table exercise add column muscle_group_pt text;
alter table exercise add column instructions_pt text;
alter table workout_day add column day_of_week smallint check (day_of_week between 1 and 7);
```

- [ ] **Step 2: Aplicar a migration**

Run:
```bash
npx supabase db push
```
Expected: `Finished supabase db push`. Aditivo, não afeta nenhuma tabela do CRM.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260713010000_add_translation_and_weekday.sql
git commit -m "feat: add translation columns and day_of_week to schema"
```

---

## Task 2: Localizar os rótulos do split (Push/Pull/Legs em português)

**Files:**
- Modify: `lib/plan-engine/split.ts`, `lib/plan-engine/split.test.ts`

**Interfaces:**
- Produces: `SplitDay.label` agora em português ("Empurrar", "Puxar", "Pernas", "Superior", "Inferior", "Corpo Inteiro N")

- [ ] **Step 1: Atualizar o teste (falhando)**

Modify `lib/plan-engine/split.test.ts`, trocar as strings esperadas:
```typescript
  it('uses full body for 2-3 days per week', () => {
    expect(chooseSplit(2).type).toBe('full_body')
    expect(chooseSplit(3).type).toBe('full_body')
    expect(chooseSplit(3).days).toHaveLength(3)
    expect(chooseSplit(3).days[0].label).toBe('Corpo Inteiro 1')
  })

  it('uses upper/lower for 4 days per week', () => {
    const result = chooseSplit(4)
    expect(result.type).toBe('upper_lower')
    expect(result.days.map((d) => d.label)).toEqual(['Superior', 'Inferior', 'Superior', 'Inferior'])
  })

  it('uses push/pull/legs for 5-6 days per week', () => {
    const result5 = chooseSplit(5)
    expect(result5.type).toBe('push_pull_legs')
    expect(result5.days.map((d) => d.label)).toEqual(['Empurrar', 'Puxar', 'Pernas', 'Empurrar', 'Puxar'])

    const result6 = chooseSplit(6)
    expect(result6.days.map((d) => d.label)).toEqual([
      'Empurrar', 'Puxar', 'Pernas', 'Empurrar', 'Puxar', 'Pernas',
    ])
  })
```
(manter o teste de `chooseSplit(0)`/`chooseSplit(8)` lançando erro, sem mudança.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — labels ainda em inglês.

- [ ] **Step 3: Atualizar `lib/plan-engine/split.ts`**

Trocar as strings de label:
```typescript
export function chooseSplit(daysPerWeek: number): { type: SplitType; days: SplitDay[] } {
  if (daysPerWeek < 1 || daysPerWeek > 7) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  if (daysPerWeek <= 3) {
    const days: SplitDay[] = Array.from({ length: daysPerWeek }, (_, i) => ({
      label: `Corpo Inteiro ${i + 1}`,
      targets: FULL_BODY_TARGETS,
    }))
    return { type: 'full_body', days }
  }

  if (daysPerWeek === 4) {
    const days: SplitDay[] = [
      { label: 'Superior', targets: UPPER_TARGETS },
      { label: 'Inferior', targets: LOWER_TARGETS },
      { label: 'Superior', targets: UPPER_TARGETS },
      { label: 'Inferior', targets: LOWER_TARGETS },
    ]
    return { type: 'upper_lower', days }
  }

  const cycle: SplitDay[] = [
    { label: 'Empurrar', targets: PUSH_TARGETS },
    { label: 'Puxar', targets: PULL_TARGETS },
    { label: 'Pernas', targets: LEGS_TARGETS },
  ]
  const days = Array.from({ length: daysPerWeek }, (_, i) => cycle[i % 3])
  return { type: 'push_pull_legs', days }
}
```
(o resto do arquivo, incluindo os `*_TARGETS` em inglês que batem com a coluna `target` da ExerciseDB, permanece igual — só os `label` mudam.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/split.ts lib/plan-engine/split.test.ts
git commit -m "feat: localize split day labels to Portuguese"
```

---

## Task 3: Atribuição automática de dia da semana

**Files:**
- Create: `lib/plan-engine/weekdays.ts`, `lib/plan-engine/weekdays.test.ts`
- Modify: `lib/plan-engine/generate-month.ts`, `lib/plan-engine/generate-month.test.ts`

**Interfaces:**
- Produces: `assignWeekdays(daysPerWeek: number): number[]` (retorna números ISO 1-7, segunda a domingo), `generateFirstMonth` agora grava `day_of_week` em cada `workout_day`

- [ ] **Step 1: Escrever o teste de `assignWeekdays` (falhando)**

Create `lib/plan-engine/weekdays.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { assignWeekdays } from './weekdays'

describe('assignWeekdays', () => {
  it('spreads 1 day to Monday', () => {
    expect(assignWeekdays(1)).toEqual([1])
  })

  it('spreads 3 days to Mon/Wed/Fri', () => {
    expect(assignWeekdays(3)).toEqual([1, 3, 5])
  })

  it('spreads 4 days to Mon/Tue/Thu/Fri', () => {
    expect(assignWeekdays(4)).toEqual([1, 2, 4, 5])
  })

  it('spreads 6 days to Mon through Sat', () => {
    expect(assignWeekdays(6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('spreads 7 days to every day', () => {
    expect(assignWeekdays(7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/weekdays.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/weekdays.ts`**

```typescript
const PATTERNS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
}

export function assignWeekdays(daysPerWeek: number): number[] {
  const pattern = PATTERNS[daysPerWeek]

  if (!pattern) {
    throw new Error(`daysPerWeek fora do intervalo esperado (1-7): ${daysPerWeek}`)
  }

  return pattern
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
git add lib/plan-engine/weekdays.ts lib/plan-engine/weekdays.test.ts
git commit -m "feat: add automatic weekday assignment"
```

- [ ] **Step 6: Atualizar o teste de `generate-month` pra cobrir `day_of_week` (falhando)**

Modify `lib/plan-engine/generate-month.test.ts`, no primeiro `it`, adicionar depois das asserções de `weekNumbers`:
```typescript
    const weekdays = (supabase.insertedRows.workout_day as { day_of_week: number }[]).map(
      (row) => row.day_of_week
    )
    // days_per_week: 3 -> assignWeekdays(3) = [1, 3, 5], repetido em cada uma das 4 semanas
    expect(weekdays).toEqual([1, 3, 5, 1, 3, 5, 1, 3, 5, 1, 3, 5])
```

- [ ] **Step 7: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `day_of_week` ainda não é gravado.

- [ ] **Step 8: Atualizar `lib/plan-engine/generate-month.ts`**

Adicionar o import e usar `assignWeekdays` no insert de `workout_day`:
```typescript
import { assignWeekdays } from './weekdays'
```

No topo da função, depois de `const split = chooseSplit(profile.days_per_week)`:
```typescript
  const weekdays = assignWeekdays(profile.days_per_week)
```

No loop, trocar `for (const day of split.days) {` por (precisa do índice do dia dentro da semana):
```typescript
  for (let week = 1; week <= 4; week++) {
    for (let dayIndex = 0; dayIndex < split.days.length; dayIndex++) {
      const day = split.days[dayIndex]

      const { data: workoutDay, error: dayError } = await supabase
        .from('workout_day')
        .insert([
          {
            training_plan_id: trainingPlan.id,
            week_number: week,
            day_label: day.label,
            day_of_week: weekdays[dayIndex],
          },
        ])
        .select()
        .single()
```
(o resto do corpo do loop continua igual, só fechar as chaves considerando o `for` agora usa `dayIndex`/`day` em vez de `for...of`.)

- [ ] **Step 9: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/plan-engine/generate-month.ts lib/plan-engine/generate-month.test.ts
git commit -m "feat: assign weekdays to generated workout days"
```

---

## Task 4: Script de tradução em lote

**Files:**
- Create: `lib/openai/translate.ts`, `lib/openai/translate.test.ts`, `scripts/translate-exercises.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `translateExerciseBatch(exercises: { id: string; name: string; muscle_group: string; instructions: string }[]): Promise<{ id: string; name_pt: string; muscle_group_pt: string; instructions_pt: string }[]>`; comando `npm run translate:exercises`

> **Nota de implementação:** assim como no `lib/openai/client.ts` (Fase 3), verifique o formato real da API instalada do pacote `openai` antes de finalizar — em particular se `response_format: { type: 'json_object' }` é suportado pelo modelo/SDK instalado, ou se é preciso usar outro mecanismo pra garantir saída em JSON. Documente qualquer adaptação.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/openai/translate.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { translateExerciseBatch } from './translate'

describe('translateExerciseBatch', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('sends exercises to the model and returns the parsed translations', async () => {
    const input = [
      { id: '1', name: 'push-up', muscle_group: 'chest', instructions: 'Lower your body.' },
    ]
    const output = {
      translations: [
        { id: '1', name_pt: 'flexão', muscle_group_pt: 'peito', instructions_pt: 'Abaixe o corpo.' },
      ],
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(output) } }],
    })

    const result = await translateExerciseBatch(input)

    expect(result).toEqual(output.translations)
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(translateExerciseBatch([])).rejects.toThrow('Missing OPENAI_API_KEY')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/openai/translate.ts` não existe.

- [ ] **Step 3: Implementar `lib/openai/translate.ts`**

```typescript
import OpenAI from 'openai'

export type ExerciseToTranslate = {
  id: string
  name: string
  muscle_group: string
  instructions: string
}

export type TranslatedExercise = {
  id: string
  name_pt: string
  muscle_group_pt: string
  instructions_pt: string
}

export async function translateExerciseBatch(
  exercises: ExerciseToTranslate[]
): Promise<TranslatedExercise[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  if (exercises.length === 0) {
    return []
  }

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: 'gpt-5.4-nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você traduz nomes, grupos musculares e instruções de exercícios de academia do inglês para português do Brasil, de forma natural e direta (sem traduzir literalmente termos técnicos consagrados quando não fizer sentido). Responda SOMENTE com um JSON no formato {"translations": [{"id": string, "name_pt": string, "muscle_group_pt": string, "instructions_pt": string}]}, mantendo o "id" original de cada exercício.',
      },
      {
        role: 'user',
        content: JSON.stringify(exercises),
      },
    ],
  })

  const content = completion.choices[0].message.content ?? '{"translations": []}'
  const parsed = JSON.parse(content) as { translations: TranslatedExercise[] }

  return parsed.translations
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
git add lib/openai/translate.ts lib/openai/translate.test.ts
git commit -m "feat: add batch exercise translation via OpenAI"
```

- [ ] **Step 6: Criar o script de tradução em lote**

Create `scripts/translate-exercises.ts`:
```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })

import { translateExerciseBatch } from '../lib/openai/translate'
import { createServerSupabaseClient } from '../lib/supabase/server'

const BATCH_SIZE = 25

async function main() {
  const supabase = createServerSupabaseClient()

  const { data: pending, error } = await supabase
    .from('exercise')
    .select('id, name, muscle_group, instructions')
    .is('name_pt', null)
    .range(0, 1999)

  if (error) {
    throw new Error(error.message)
  }

  const exercises = pending ?? []
  console.log(`Traduzindo ${exercises.length} exercícios em lotes de ${BATCH_SIZE}...`)

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE)
    const translations = await translateExerciseBatch(batch)

    for (const translation of translations) {
      const { error: updateError } = await supabase
        .from('exercise')
        .update({
          name_pt: translation.name_pt,
          muscle_group_pt: translation.muscle_group_pt,
          instructions_pt: translation.instructions_pt,
        })
        .eq('id', translation.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    console.log(`Lote ${i / BATCH_SIZE + 1}: ${translations.length} exercícios traduzidos.`)
  }

  console.log('Tradução concluída.')
}

main().catch((error) => {
  console.error('Falha na tradução:', error)
  process.exit(1)
})
```

- [ ] **Step 7: Adicionar o script no `package.json`**

```json
"translate:exercises": "tsx scripts/translate-exercises.ts"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/translate-exercises.ts package.json
git commit -m "feat: add exercise translation script"
```

---

## Task 5: Rodar a tradução real

> **Atenção:** esta tarefa faz ~56 chamadas reais à OpenAI (1394 exercícios ÷ 25 por lote) e escreve nas colunas `_pt` de todo o catálogo. Rodar exatamente uma vez. Como é um `update` condicional por `id` (não um `upsert` genérico), rodar de novo só re-traduziria linhas que ainda estiverem com `name_pt` nulo — seguro, mas evite rodar sem necessidade.

**Files:**
- Test: `lib/openai/translation-backfill.test.ts`

**Interfaces:**
- Consumes: `npm run translate:exercises` (Task 4)

- [ ] **Step 1: Escrever o teste de verificação (falhando)**

Create `lib/openai/translation-backfill.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise translation backfill', () => {
  it('has name_pt populated for the vast majority of rows', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT COUNT(*)::int AS total, COUNT(name_pt)::int AS translated FROM exercise`
    )

    await client.end()

    const { total, translated } = result.rows[0]
    expect(translated).toBeGreaterThan(total * 0.9)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — nenhuma linha traduzida ainda.

- [ ] **Step 3: Rodar a tradução de verdade**

Run:
```bash
npm run translate:exercises
```
Expected: imprime o progresso lote a lote e termina com `Tradução concluída.`, sem erro. Se der erro no meio, não rodar de novo sem investigar — reportar o erro exato.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/openai/translation-backfill.test.ts
git commit -m "test: verify exercise translation backfill"
```

---

## Task 6: Rota de imagem sob demanda (cache de GIF)

**Files:**
- Create: `supabase/migrations/20260713020000_create_exercise_gifs_bucket.sql`, `app/api/exercises/[id]/gif/route.ts`
- Test: `app/api/exercises/[id]/gif/route.test.ts`

**Interfaces:**
- Produces: `GET /api/exercises/:id/gif` — redireciona pro GIF já cacheado no Storage, ou busca da ExerciseDB na primeira vez, salva no Storage, atualiza `exercise.media_url`, e redireciona

- [ ] **Step 1: Criar o bucket de storage**

Create `supabase/migrations/20260713020000_create_exercise_gifs_bucket.sql`:
```sql
insert into storage.buckets (id, name, public)
values ('exercise-gifs', 'exercise-gifs', true)
on conflict (id) do nothing;
```

Run:
```bash
npx supabase db push
```
Expected: `Finished supabase db push`.

- [ ] **Step 2: Escrever o teste da rota (falhando)**

Create `app/api/exercises/[id]/gif/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }))
const mockUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockGetPublicUrl = vi.hoisted(() =>
  vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example/exercise-gifs/0001.gif' } })
)

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      update: mockUpdate,
    }),
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

const originalFetch = global.fetch

import { GET } from './route'

describe('GET /api/exercises/:id/gif', () => {
  beforeEach(() => {
    mockSingle.mockReset()
    process.env.EXERCISEDB_API_KEY = 'test-key'
    process.env.EXERCISEDB_API_HOST = 'exercisedb.p.rapidapi.com'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('redirects straight to media_url when already cached', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'ex-1', external_id: '0001', media_url: 'https://storage.example/cached.gif' },
      error: null,
    })

    const response = await GET(new Request('http://localhost/api/exercises/ex-1/gif'), {
      params: Promise.resolve({ id: 'ex-1' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://storage.example/cached.gif')
    expect(global.fetch).not.toBeDefined
  })

  it('fetches from ExerciseDB, caches, and redirects when not yet cached', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'ex-1', external_id: '0001', media_url: null },
      error: null,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }) as unknown as typeof fetch

    const response = await GET(new Request('http://localhost/api/exercises/ex-1/gif'), {
      params: Promise.resolve({ id: 'ex-1' }),
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exercisedb.p.rapidapi.com/image?exerciseId=0001'),
      expect.anything()
    )
    expect(mockUpload).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ media_url: 'https://storage.example/exercise-gifs/0001.gif' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://storage.example/exercise-gifs/0001.gif')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `app/api/exercises/[id]/gif/route.ts` não existe.

- [ ] **Step 4: Implementar `app/api/exercises/[id]/gif/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: exercise, error } = await supabase
    .from('exercise')
    .select('id, external_id, media_url')
    .eq('id', id)
    .single()

  if (error || !exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  if (exercise.media_url) {
    return NextResponse.redirect(exercise.media_url)
  }

  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const gifResponse = await fetch(
    `https://${apiHost}/image?exerciseId=${exercise.external_id}&resolution=180`,
    { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost } }
  )

  if (!gifResponse.ok) {
    throw new Error(`ExerciseDB image request failed: ${gifResponse.status}`)
  }

  const gifBuffer = await gifResponse.arrayBuffer()
  const path = `${exercise.external_id}.gif`

  const { error: uploadError } = await supabase.storage
    .from('exercise-gifs')
    .upload(path, gifBuffer, { contentType: 'image/gif', upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage.from('exercise-gifs').getPublicUrl(path)

  await supabase.from('exercise').update({ media_url: publicUrlData.publicUrl }).eq('id', exercise.id)

  return NextResponse.redirect(publicUrlData.publicUrl)
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
git add supabase/migrations/20260713020000_create_exercise_gifs_bucket.sql app/api/exercises/\[id\]/gif/route.ts app/api/exercises/\[id\]/gif/route.test.ts
git commit -m "feat: add on-demand exercise GIF caching route"
```

---

## Task 7: Rota de marcar treino como concluído

**Files:**
- Create: `app/api/workout-sessions/complete/route.ts`
- Test: `app/api/workout-sessions/complete/route.test.ts`

**Interfaces:**
- Produces: `POST /api/workout-sessions/complete` — recebe `{ userId: string; workoutDayId: string }`, cria uma linha em `workout_session` com `completed: true`

- [ ] **Step 1: Escrever o teste (falhando)**

Create `app/api/workout-sessions/complete/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}))

import { POST } from './route'

describe('POST /api/workout-sessions/complete', () => {
  beforeEach(() => {
    mockInsert.mockClear()
  })

  it('creates a completed workout_session row', async () => {
    const request = new Request('http://localhost/api/workout-sessions/complete', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', workoutDayId: 'day-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(mockInsert).toHaveBeenCalledWith([
      { user_id: 'user-1', workout_day_id: 'day-1', completed: true },
    ])
    expect(body).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a rota não existe.

- [ ] **Step 3: Implementar `app/api/workout-sessions/complete/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { userId, workoutDayId } = (await request.json()) as {
    userId: string
    workoutDayId: string
  }

  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('workout_session')
    .insert([{ user_id: userId, workout_day_id: workoutDayId, completed: true }])

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ ok: true })
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
git add app/api/workout-sessions/complete/route.ts app/api/workout-sessions/complete/route.test.ts
git commit -m "feat: add workout completion route"
```

---

## Task 8: Reformular a página `/plano` — acordeão por dia da semana, tradução, imagem, check

**Files:**
- Modify: `app/plano/page.tsx`
- Create: `app/plano/PlanoInterativo.tsx`

**Interfaces:**
- Consumes: colunas `_pt` (Task 5), `day_of_week` (Task 3), `GET /api/exercises/:id/gif` (Task 6), `POST /api/workout-sessions/complete` (Task 7)
- Produces: `/plano` como server component buscando os dados; `PlanoInterativo` (client component) renderiza o acordeão

- [ ] **Step 1: Criar o client component `app/plano/PlanoInterativo.tsx`**

```tsx
'use client'

import { useState } from 'react'

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
}

type ExerciseItem = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
}

type DayItem = {
  id: string
  dayLabel: string
  dayOfWeek: number | null
  exercises: ExerciseItem[]
}

export default function PlanoInterativo({
  days,
  userId,
}: {
  days: DayItem[]
  userId: string
}) {
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null)
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(new Set())

  async function markComplete(dayId: string) {
    await fetch('/api/workout-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, workoutDayId: dayId }),
    })
    setCompletedDayIds((current) => new Set(current).add(dayId))
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const isOpen = openDayId === day.id
        const isCompleted = completedDayIds.has(day.id)

        return (
          <div key={day.id} className="rounded-2xl border border-border-subtle bg-surface">
            <button
              type="button"
              onClick={() => setOpenDayId(isOpen ? null : day.id)}
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
                  {day.dayOfWeek ? WEEKDAY_NAMES[day.dayOfWeek] : 'Dia'}
                </p>
                <h2 className="font-display text-2xl uppercase">{day.dayLabel}</h2>
              </div>
              <span aria-hidden className="text-2xl text-brand">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle p-6">
                <ul className="space-y-4">
                  {day.exercises.map((exercise) => (
                    <li key={exercise.id} className="flex items-center gap-4">
                      <img
                        src={`/api/exercises/${exercise.exerciseId}/gif`}
                        alt={exercise.name}
                        className="h-16 w-16 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{exercise.name}</p>
                        <p className="text-xs text-foreground/60">
                          {exercise.targetSets}x{exercise.targetReps}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => markComplete(day.id)}
                  disabled={isCompleted}
                  className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold uppercase tracking-wide text-black disabled:opacity-50"
                >
                  {isCompleted ? 'Treino concluído' : 'Marcar como concluído'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Reescrever `app/plano/page.tsx`**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import PlanoInterativo from './PlanoInterativo'

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

  const { data: userData } = await supabase.auth.getUser()

  const { data: days } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, day_of_week, week_number, workout_day_exercise(id, target_sets, target_reps, exercise(id, name, name_pt))'
    )
    .eq('training_plan_id', id)
    .eq('week_number', 1)
    .order('day_of_week')

  const formattedDays = (days ?? []).map((day) => ({
    id: day.id,
    dayLabel: day.day_label,
    dayOfWeek: day.day_of_week,
    exercises: (
      day.workout_day_exercise as unknown as Array<{
        id: string
        target_sets: number
        target_reps: number
        exercise: { id: string; name: string; name_pt: string | null }
      }>
    ).map((item) => ({
      id: item.id,
      exerciseId: item.exercise.id,
      name: item.exercise.name_pt ?? item.exercise.name,
      targetSets: item.target_sets,
      targetReps: item.target_reps,
    })),
  }))

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

      <PlanoInterativo days={formattedDays} userId={userData.user?.id ?? ''} />
    </main>
  )
}
```

- [ ] **Step 3: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 4: Grep por travessão**

Run:
```bash
grep -n "—" app/plano/page.tsx app/plano/PlanoInterativo.tsx
```
Expected: nenhum resultado. Se aparecer algo, corrigir antes de commitar.

- [ ] **Step 5: Commit**

```bash
git add app/plano/page.tsx app/plano/PlanoInterativo.tsx
git commit -m "feat: redesign plan page with weekday accordion, translations, images and completion check"
```

---

## Fim desta fase

Ao final: `/plano` mostra o treino da semana 1 organizado em acordeão por dia da semana (em português), com nome/instrução dos exercícios traduzidos, imagem de demonstração de cada um (buscada e cacheada sob demanda), e um botão pra marcar o treino do dia como concluído (grava em `workout_session`).
