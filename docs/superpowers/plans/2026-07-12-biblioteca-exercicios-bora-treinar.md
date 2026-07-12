# Biblioteca de Exercícios — Bora Treinar! Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popular a tabela `exercise` (criada na Fase 1) com o catálogo real da ExerciseDB (nome, grupo muscular, instrução, GIF de demonstração) e ter uma página que lista esses exercícios, servindo de base de dados para a geração de treinos nas próximas fases.

**Architecture:** Um cliente HTTP fino para a API da ExerciseDB (`lib/exercisedb/client.ts`), uma função pura de mapeamento pro formato da tabela `exercise` (`lib/exercisedb/map.ts`), um script standalone de sincronização (`scripts/sync-exercises.ts`, rodado manualmente via `npm run sync:exercises` — nunca em request de usuário, pra não estourar limite de requisições da API gratuita), e uma página server-side (`app/exercicios/page.tsx`) que lê o catálogo já sincronizado no Supabase.

**Tech Stack:** Next.js (App Router), TypeScript, Vitest, Supabase (tabela `exercise` já existente), ExerciseDB API (via RapidAPI), `tsx` (rodar scripts TypeScript standalone).

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — nenhuma migration nova nesta fase (a tabela `exercise` já existe desde a Fase 1), mas se qualquer alteração de schema for necessária, seguir as mesmas regras: só `supabase db push`, nunca `db reset`/`drop`/`truncate`
- RLS: a tabela `exercise` já tem a policy `exercise_read_authenticated` (select para usuários autenticados); escritas (o sync) acontecem via `createServerSupabaseClient()` (service_role, bypassa RLS) — nunca inserir exercícios pelo cliente browser
- A API da ExerciseDB tem cota limitada no plano gratuito — o cliente/script deve fazer o mínimo de requisições possível (idealmente 1 chamada bulk), nunca um loop de centenas de chamadas
- Paleta visual: fundo claro (`#FFFFFF`), texto preto (`#0A0A0A`), destaque verde água (`#2DD4BF`) — reaproveitar os tokens `bg-background`/`text-foreground`/`bg-brand` já configurados na Fase 1
- Credenciais da ExerciseDB (`EXERCISEDB_API_KEY`, `EXERCISEDB_API_HOST`) vão em `.env.local` (nunca commitadas, já coberto pelo `.gitignore` existente)

---

## Task 1: Cliente da API ExerciseDB

**Files:**
- Create: `lib/exercisedb/client.ts`
- Test: `lib/exercisedb/client.test.ts`

**Interfaces:**
- Consumes: `EXERCISEDB_API_KEY`, `EXERCISEDB_API_HOST` (env vars, fornecidas pelo usuário)
- Produces: `fetchAllExercises(): Promise<ExerciseDbExercise[]>`, tipo `ExerciseDbExercise` exportado de `lib/exercisedb/client.ts`, consumido pelo Task 2

> **Nota de implementação:** o formato exato da resposta da ExerciseDB abaixo é a minha melhor expectativa, mas essa API pode ter mudado. **Antes de escrever o teste**, faça UMA chamada real com `curl` usando a chave fornecida (ex: `curl -s "https://<HOST>/exercises?limit=3" -H "X-RapidAPI-Key: <KEY>" -H "X-RapidAPI-Host: <HOST>"`) e confira se os campos batem com o tipo `ExerciseDbExercise` abaixo. Se a resposta vier diferente (nomes de campo diferentes, paginação em formato de objeto em vez de array puro, etc.), ajuste o tipo e o teste de acordo — documente a mudança no seu relatório, igual foi feito na Fase 1 quando o Tailwind v4 divergiu do plano original.

- [ ] **Step 1: Escrever o teste do cliente (falhando)**

Create `lib/exercisedb/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllExercises } from './client'

describe('fetchAllExercises', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.EXERCISEDB_API_KEY = 'test-key'
    process.env.EXERCISEDB_API_HOST = 'exercisedb.p.rapidapi.com'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('calls the ExerciseDB API with the right headers and returns the parsed list', async () => {
    const mockExercises = [
      {
        id: '0001',
        name: 'push-up',
        bodyPart: 'chest',
        equipment: 'body weight',
        gifUrl: 'https://example.com/0001.gif',
        target: 'pectorals',
        secondaryMuscles: ['triceps'],
        instructions: ['Step 1', 'Step 2'],
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExercises,
    }) as unknown as typeof fetch

    const result = await fetchAllExercises()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exercisedb.p.rapidapi.com/exercises'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-RapidAPI-Key': 'test-key',
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        }),
      })
    )
    expect(result).toEqual(mockExercises)
  })

  it('throws when the API responds with an error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    await expect(fetchAllExercises()).rejects.toThrow('ExerciseDB request failed: 401')
  })

  it('throws when credentials are missing', async () => {
    delete process.env.EXERCISEDB_API_KEY
    delete process.env.EXERCISEDB_API_HOST

    await expect(fetchAllExercises()).rejects.toThrow('Missing ExerciseDB API credentials')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/exercisedb/client.ts` não existe ainda.

- [ ] **Step 3: Implementar `lib/exercisedb/client.ts`**

```typescript
export type ExerciseDbExercise = {
  id: string
  name: string
  bodyPart: string
  equipment: string
  gifUrl: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
}

export async function fetchAllExercises(): Promise<ExerciseDbExercise[]> {
  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const response = await fetch(`https://${apiHost}/exercises?limit=2000`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': apiHost,
    },
  })

  if (!response.ok) {
    throw new Error(`ExerciseDB request failed: ${response.status}`)
  }

  return response.json()
}
```

Se a verificação com `curl` do início desta tarefa mostrou um formato diferente, ajuste este tipo/implementação agora, antes de rodar o teste.

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/exercisedb/client.ts lib/exercisedb/client.test.ts
git commit -m "feat: add ExerciseDB API client"
```

---

## Task 2: Mapeamento e script de sincronização

**Files:**
- Create: `lib/exercisedb/map.ts`, `lib/exercisedb/map.test.ts`, `scripts/sync-exercises.ts`
- Modify: `package.json` (script `sync:exercises`)

**Interfaces:**
- Consumes: `ExerciseDbExercise` do Task 1, `createServerSupabaseClient()` de `lib/supabase/server.ts` (Fase 1)
- Produces: `mapToExerciseRow(exercise: ExerciseDbExercise): ExerciseRow`, tipo `ExerciseRow`; comando `npm run sync:exercises`

- [ ] **Step 1: Instalar `tsx` para rodar scripts TypeScript standalone**

Run:
```bash
npm install -D tsx
```

- [ ] **Step 2: Escrever o teste de mapeamento (falhando)**

Create `lib/exercisedb/map.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mapToExerciseRow } from './map'
import type { ExerciseDbExercise } from './client'

describe('mapToExerciseRow', () => {
  it('maps an ExerciseDB entry to the exercise table row shape', () => {
    const input: ExerciseDbExercise = {
      id: '0001',
      name: 'push-up',
      bodyPart: 'chest',
      equipment: 'body weight',
      gifUrl: 'https://example.com/0001.gif',
      target: 'pectorals',
      secondaryMuscles: ['triceps'],
      instructions: ['Step 1', 'Step 2'],
    }

    expect(mapToExerciseRow(input)).toEqual({
      external_id: '0001',
      name: 'push-up',
      instructions: 'Step 1\nStep 2',
      muscle_group: 'chest',
      equipment: 'body weight',
      media_url: 'https://example.com/0001.gif',
    })
  })

  it('maps missing equipment/gif to null instead of empty string', () => {
    const input: ExerciseDbExercise = {
      id: '0002',
      name: 'plank',
      bodyPart: 'waist',
      equipment: '',
      gifUrl: '',
      target: 'abs',
      secondaryMuscles: [],
      instructions: ['Hold position'],
    }

    const result = mapToExerciseRow(input)

    expect(result.equipment).toBeNull()
    expect(result.media_url).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/exercisedb/map.ts` não existe.

- [ ] **Step 4: Implementar `lib/exercisedb/map.ts`**

```typescript
import type { ExerciseDbExercise } from './client'

export type ExerciseRow = {
  external_id: string
  name: string
  instructions: string
  muscle_group: string
  equipment: string | null
  media_url: string | null
}

export function mapToExerciseRow(exercise: ExerciseDbExercise): ExerciseRow {
  return {
    external_id: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions.join('\n'),
    muscle_group: exercise.bodyPart,
    equipment: exercise.equipment || null,
    media_url: exercise.gifUrl || null,
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 6: Criar o script de sincronização**

Create `scripts/sync-exercises.ts`:
```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })

import { fetchAllExercises } from '../lib/exercisedb/client'
import { mapToExerciseRow } from '../lib/exercisedb/map'
import { createServerSupabaseClient } from '../lib/supabase/server'

async function main() {
  console.log('Buscando exercícios na ExerciseDB...')
  const exercises = await fetchAllExercises()
  console.log(`Recebidos ${exercises.length} exercícios da API.`)

  const rows = exercises.map(mapToExerciseRow)

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('exercise')
    .upsert(rows, { onConflict: 'external_id' })

  if (error) {
    throw error
  }

  console.log(`Sincronizados ${rows.length} exercícios no Supabase.`)
}

main().catch((error) => {
  console.error('Falha na sincronização:', error)
  process.exit(1)
})
```

- [ ] **Step 7: Adicionar o script no `package.json`**

No `"scripts"` de `package.json`, adicionar:
```json
"sync:exercises": "tsx scripts/sync-exercises.ts"
```

- [ ] **Step 8: Commit**

```bash
git add lib/exercisedb/map.ts lib/exercisedb/map.test.ts scripts/sync-exercises.ts package.json package-lock.json
git commit -m "feat: add exercise mapping and sync script"
```

---

## Task 3: Rodar a sincronização real e verificar os dados

> **Atenção:** esta tarefa faz UMA chamada real à API da ExerciseDB (consome cota do plano gratuito) e escreve de verdade na tabela `exercise` do banco compartilhado com o CRM. É uma operação de `upsert` (nunca apaga linhas existentes), então é segura mesmo rodando mais de uma vez.

**Files:**
- Test: `lib/exercisedb/sync.test.ts`

**Interfaces:**
- Consumes: `npm run sync:exercises` (Task 2), `SUPABASE_DB_URL` (`.env.test`, da Fase 1)
- Produces: tabela `exercise` populada no Supabase

- [ ] **Step 1: Escrever o teste de verificação (falhando)**

Create `lib/exercisedb/sync.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

describe('exercise table after sync', () => {
  it('has a substantial number of exercises populated', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query('SELECT COUNT(*)::int AS count FROM exercise')

    await client.end()

    expect(result.rows[0].count).toBeGreaterThan(500)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a tabela `exercise` ainda está vazia (0 linhas).

- [ ] **Step 3: Rodar a sincronização de verdade**

Run:
```bash
npm run sync:exercises
```
Expected: imprime `Buscando exercícios na ExerciseDB...`, depois `Recebidos N exercícios da API.` e `Sincronizados N exercícios no Supabase.`, sem erro. Se der erro de autenticação (401/403), a chave/host em `.env.local` está errada — pare e reporte, não tente adivinhar outra chave.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exercisedb/sync.test.ts
git commit -m "test: verify exercise table is populated after sync"
```

---

## Task 4: Página de listagem da biblioteca de exercícios

**Files:**
- Create: `app/exercicios/page.tsx`
- Modify: `app/page.tsx` (link para a nova página)

**Interfaces:**
- Consumes: `createServerSupabaseClient()` (Fase 1), tabela `exercise` populada (Task 3)
- Produces: rota `/exercicios` (protegida pelo `proxy.ts` da Fase 1, já que não está na lista de paths públicos)

- [ ] **Step 1: Criar `app/exercicios/page.tsx`**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ExerciciosPage() {
  const supabase = createServerSupabaseClient()
  const { data: exercises } = await supabase
    .from('exercise')
    .select('id, name, muscle_group, media_url')
    .order('muscle_group')

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <h1 className="mb-6 text-2xl font-semibold">Biblioteca de exercícios</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {exercises?.map((exercise) => (
          <div key={exercise.id} className="rounded border border-gray-200 p-3">
            {exercise.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={exercise.media_url}
                alt={exercise.name}
                className="h-32 w-full rounded object-cover"
              />
            )}
            <p className="mt-2 text-sm font-medium">{exercise.name}</p>
            <p className="text-xs text-gray-500">{exercise.muscle_group}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Adicionar link na página inicial**

Read the current `app/page.tsx` first (foi reescrito na revisão final da Fase 1 como placeholder). Adicionar um link para `/exercicios`, por exemplo um `<a href="/exercicios" className="text-brand underline">Ver biblioteca de exercícios</a>` abaixo do texto existente, sem remover o que já está lá.

- [ ] **Step 3: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`, com a rota `/exercicios` listada no output.

- [ ] **Step 4: Commit**

```bash
git add app/exercicios/page.tsx app/page.tsx
git commit -m "feat: add exercise library listing page"
```

---

## Fim da Fase 2

Ao final desta fase: a tabela `exercise` tem o catálogo real da ExerciseDB sincronizado, e `/exercicios` mostra a lista com nome, grupo muscular e GIF de cada exercício. Essa base alimenta a Fase 3 (onboarding conversacional + geração do primeiro plano mensal).
