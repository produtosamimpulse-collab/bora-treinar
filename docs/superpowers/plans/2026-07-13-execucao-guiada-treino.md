# Execução Guiada do Treino Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o check simples por exercício por um fluxo de execução real: tela própria por treino, um exercício por vez, registrando carga/reps de cada série (com cronômetro de descanso entre séries), que ao terminar marca o dia como concluído. O mês passa a ser navegado semana a semana, só desbloqueando a próxima quando a atual estiver 100% concluída. Ao fechar a semana 1 (calibração), o motor de regras usa a carga real registrada pra calcular a carga das semanas 2-4 (conecta `calculateProgressiveLoad`, escrito na Fase 3 mas nunca usado). Todo o app (novo e existente) ganha uma passada de responsividade pra celular.

**Architecture:** Duas tabelas já existentes desde a Fase 1 (`workout_session`, `workout_session_set`) guardam a execução real. Duas rotas novas registram séries e finalizam o treino do dia; a de finalizar dispara o cálculo de progressão quando a semana 1 inteira termina. `/plano` passa a calcular qual semana está desbloqueada e mostrar só essa. Uma nova tela `/plano/treino/[workoutDayId]` conduz a execução exercício por exercício.

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — nenhuma migration nesta fase (as tabelas necessárias já existem desde a Fase 1)
- **Nunca usar travessão (—) em nenhum texto visível na interface**
- Rotas que escrevem dados usam `getAuthenticatedUserId()`, nunca confiam em `userId` do corpo da requisição, e verificam que o recurso pertence ao usuário autenticado (mesma disciplina reforçada nos Ajustes v2, após o achado de IDOR na rota de troca de exercício)
- Paleta visual: `bg-background`/`text-foreground`/`bg-brand`/`bg-surface`/`border-border-subtle`/`font-display`
- **Responsividade:** toda tela nova e as já existentes (`/`, `/login`, `/onboarding`, `/exercicios`, `/plano`) devem funcionar bem numa largura de tela de celular (~375px), com alvos de toque de pelo menos 44px de altura em botões interativos
- **Escopo da progressão:** só a conclusão da semana 1 dispara o cálculo de carga das semanas 2-4 (usando a carga máxima registrada por exercício). Completar as semanas 2, 3 ou 4 não recalcula nada — é o escopo exato desenhado na Fase 3, não expandir aqui

---

## Task 1: Determinar a semana atual desbloqueada

**Files:**
- Create: `lib/plan-engine/week-progress.ts`, `lib/plan-engine/week-progress.test.ts`

**Interfaces:**
- Produces: `determineCurrentWeek(weekCompletion: Record<number, boolean>): number` — retorna a primeira semana (1-4) que ainda não está 100% concluída, ou 4 se todas estiverem

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/week-progress.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { determineCurrentWeek } from './week-progress'

describe('determineCurrentWeek', () => {
  it('returns week 1 when nothing is completed', () => {
    expect(determineCurrentWeek({ 1: false, 2: false, 3: false, 4: false })).toBe(1)
  })

  it('returns week 2 when week 1 is complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: false, 3: false, 4: false })).toBe(2)
  })

  it('returns week 4 when weeks 1-3 are complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: true, 3: true, 4: false })).toBe(4)
  })

  it('returns week 4 when everything is complete', () => {
    expect(determineCurrentWeek({ 1: true, 2: true, 3: true, 4: true })).toBe(4)
  })

  it('treats a missing key as not completed', () => {
    expect(determineCurrentWeek({ 1: true })).toBe(2)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/week-progress.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/week-progress.ts`**

```typescript
export function determineCurrentWeek(weekCompletion: Record<number, boolean>): number {
  for (let week = 1; week <= 4; week++) {
    if (!weekCompletion[week]) {
      return week
    }
  }
  return 4
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
git add lib/plan-engine/week-progress.ts lib/plan-engine/week-progress.test.ts
git commit -m "feat: add current-week determination logic"
```

---

## Task 2: Calcular progressão da semana 1 pras semanas 2-4

**Files:**
- Create: `lib/plan-engine/apply-progression.ts`
- Test: `lib/plan-engine/apply-progression.test.ts`

**Interfaces:**
- Consumes: `calculateProgressiveLoad` (Fase 3, Task 6)
- Produces: `applyWeek1Progression(supabase, trainingPlanId: string): Promise<void>` — pra cada exercício da semana 1 com carga registrada, calcula e grava `target_load_kg` das semanas 2-4 no `workout_day_exercise` correspondente (mesmo `day_label` e `order_index`)

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/apply-progression.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { applyWeek1Progression } from './apply-progression'

function makeSupabaseMock() {
  const updates: { table: string; id: string; values: unknown }[] = []

  const week1Days = [{ id: 'day-w1', day_label: 'Peito, Ombros e Tríceps' }]
  const week1Exercises = [{ id: 'wde-w1', exercise_id: 'ex-1', order_index: 0 }]
  const session = { id: 'session-1' }
  const sets = [{ load_kg: 40 }, { load_kg: 45 }]
  const futureDays: Record<number, { id: string }> = {
    2: { id: 'day-w2' },
    3: { id: 'day-w3' },
    4: { id: 'day-w4' },
  }
  const futureExercises: Record<string, { id: string }> = {
    'day-w2': { id: 'wde-w2' },
    'day-w3': { id: 'wde-w3' },
    'day-w4': { id: 'wde-w4' },
  }

  const from = vi.fn((table: string) => {
    if (table === 'workout_day') {
      return {
        select: () => ({
          eq: (col: string, value: unknown) => ({
            eq: (col2: string, value2: unknown) => ({
              maybeSingle: async () => {
                if (col2 === 'week_number') {
                  return { data: futureDays[value2 as number] ?? null, error: null }
                }
                return { data: null, error: null }
              },
            }),
          }),
        }),
      }
    }

    if (table === 'workout_day_exercise') {
      return {
        select: (columns: string) => ({
          eq: (col: string, value: unknown) => {
            if (columns.includes('exercise_id')) {
              return Promise.resolve({ data: week1Exercises, error: null })
            }
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: futureExercises[value as string] ?? null,
                  error: null,
                }),
              }),
            }
          },
        }),
        update: (values: unknown) => ({
          eq: (col: string, id: string) => {
            updates.push({ table: 'workout_day_exercise', id, values })
            return Promise.resolve({ error: null })
          },
        }),
      }
    }

    if (table === 'workout_session') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: session, error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'workout_session_set') {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: sets, error: null }),
          }),
        }),
      }
    }

    throw new Error(`Unexpected table in test: ${table}`)
  })

  // week1Days lookup (plain eq, no second eq)
  const originalFrom = from
  const wrappedFrom = vi.fn((table: string) => {
    if (table === 'workout_day') {
      return {
        select: (columns: string) => ({
          eq: (col: string, value: unknown) => {
            if (col === 'training_plan_id' && !columns.includes('day_label')) {
              return {
                eq: async () => ({ data: week1Days, error: null }),
              }
            }
            return originalFrom(table).select(columns).eq(col, value)
          },
        }),
      }
    }
    return originalFrom(table)
  })

  return { from: wrappedFrom, updates } as never
}

describe('applyWeek1Progression', () => {
  it('writes progressive loads to weeks 2-4 based on the max load logged in week 1', async () => {
    const supabase = makeSupabaseMock()

    await applyWeek1Progression(supabase, 'plan-1')

    const updates = (supabase as unknown as { updates: { id: string; values: { target_load_kg: number } }[] }).updates

    const week2 = updates.find((u) => u.id === 'wde-w2')
    const week3 = updates.find((u) => u.id === 'wde-w3')
    const week4 = updates.find((u) => u.id === 'wde-w4')

    expect(week2?.values.target_load_kg).toBeCloseTo(47.25)
    expect(week3?.values.target_load_kg).toBeCloseTo(49.6125)
    expect(week4?.values.target_load_kg).toBeCloseTo(50.852812500000004)
  })
})
```

> **Nota de implementação:** este teste tem um mock deliberadamente elaborado (a query real encadeia `.eq().eq().maybeSingle()` em pontos diferentes com significados diferentes). Se ao implementar você achar mais direto reescrever o mock inteiro do zero pra bater exatamente com as chamadas que o seu código real faz, faça isso — o que importa é a asserção final: com 45kg de carga máxima registrada na semana 1, a semana 2 recebe 45 × 1.05 = 47.25kg, a semana 3 recebe 47.25 × 1.05 = 49.6125kg, e a semana 4 recebe 49.6125 × 1.025 ≈ 50.85kg (mesma matemática de `calculateProgressiveLoad`, já testada na Fase 3).

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/apply-progression.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/apply-progression.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateProgressiveLoad } from './progression'

export async function applyWeek1Progression(
  supabase: SupabaseClient,
  trainingPlanId: string
): Promise<void> {
  const { data: week1Days } = await supabase
    .from('workout_day')
    .select('id, day_label')
    .eq('training_plan_id', trainingPlanId)
    .eq('week_number', 1)

  for (const day of week1Days ?? []) {
    const { data: exercises } = await supabase
      .from('workout_day_exercise')
      .select('id, exercise_id, order_index')
      .eq('workout_day_id', day.id)

    const { data: session } = await supabase
      .from('workout_session')
      .select('id')
      .eq('workout_day_id', day.id)
      .eq('completed', true)
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      continue
    }

    for (const exercise of exercises ?? []) {
      const { data: sets } = await supabase
        .from('workout_session_set')
        .select('load_kg')
        .eq('workout_session_id', session.id)
        .eq('exercise_id', exercise.exercise_id)

      const loads = (sets ?? [])
        .map((set) => set.load_kg as number | null)
        .filter((load): load is number => load != null)

      if (loads.length === 0) {
        continue
      }

      const baseLoad = Math.max(...loads)

      for (const week of [2, 3, 4] as const) {
        const { data: futureDay } = await supabase
          .from('workout_day')
          .select('id')
          .eq('training_plan_id', trainingPlanId)
          .eq('week_number', week)
          .maybeSingle()

        if (!futureDay) {
          continue
        }

        const { data: futureExercise } = await supabase
          .from('workout_day_exercise')
          .select('id')
          .eq('workout_day_id', futureDay.id)
          .maybeSingle()

        if (!futureExercise) {
          continue
        }

        const newLoad = calculateProgressiveLoad(baseLoad, week)

        await supabase
          .from('workout_day_exercise')
          .update({ target_load_kg: newLoad })
          .eq('id', futureExercise.id)
      }
    }
  }
}
```

> **Atenção:** a query de `futureDay` acima precisa filtrar também por `day_label` igual ao `day.day_label` (pra achar o MESMO dia da semana futura, não qualquer dia daquela semana), e a de `futureExercise` precisa filtrar por `order_index` igual ao `exercise.order_index` (pra achar o exercício na MESMA posição). Adicione esses filtros com `.eq('day_label', day.day_label)` e `.eq('order_index', exercise.order_index)` respectivamente antes do `.maybeSingle()` — o código acima ficou simplificado no texto do plano, mas a implementação real precisa dessas duas condições extras pra não pegar o dia/exercício errado quando há mais de um dia por semana.

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/apply-progression.ts lib/plan-engine/apply-progression.test.ts
git commit -m "feat: wire week-1 progression calculation to weeks 2-4"
```

---

## Task 3: Rota de registrar série executada

**Files:**
- Create: `app/api/workout-day/[workoutDayId]/log-set/route.ts`
- Test: `app/api/workout-day/[workoutDayId]/log-set/route.test.ts`

**Interfaces:**
- Produces: `POST /api/workout-day/:workoutDayId/log-set` — recebe `{ exerciseId: string; setNumber: number; repsDone: number; loadKg: number | null }`. Cria (se ainda não existir) um `workout_session` pra esse dia+usuário, e insere a linha em `workout_session_set`. Retorna `{ sessionId: string }`.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `app/api/workout-day/[workoutDayId]/log-set/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockDayOwnerSingle = vi.hoisted(() => vi.fn())
const mockSessionMaybeSingle = vi.hoisted(() => vi.fn())
const mockSessionInsertSingle = vi.hoisted(() => vi.fn())
const mockSetInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day') {
        return { select: () => ({ eq: () => ({ single: mockDayOwnerSingle }) }) }
      }
      if (table === 'workout_session') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: mockSessionMaybeSingle }) }),
          }),
          insert: () => ({ select: () => ({ single: mockSessionInsertSingle }) }),
        }
      }
      // table === 'workout_session_set'
      return { insert: mockSetInsert }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/workout-day/day-1/log-set', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/workout-day/:workoutDayId/log-set', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockDayOwnerSingle.mockReset()
    mockDayOwnerSingle.mockResolvedValue({
      data: { id: 'day-1', training_plan: { user_id: 'user-1' } },
      error: null,
    })
    mockSessionMaybeSingle.mockReset()
    mockSessionInsertSingle.mockReset()
    mockSetInsert.mockClear()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest({}), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when the day does not belong to the caller', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: { id: 'day-1', training_plan: { user_id: 'someone-else' } },
      error: null,
    })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 1, repsDone: 10, loadKg: 40 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )

    expect(response.status).toBe(404)
  })

  it('creates a session when none exists yet, then logs the set', async () => {
    mockSessionMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockSessionInsertSingle.mockResolvedValue({ data: { id: 'session-1' }, error: null })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 1, repsDone: 10, loadKg: 40 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )
    const body = await response.json()

    expect(mockSetInsert).toHaveBeenCalledWith([
      { workout_session_id: 'session-1', exercise_id: 'ex-1', set_number: 1, reps_done: 10, load_kg: 40 },
    ])
    expect(body).toEqual({ sessionId: 'session-1' })
  })

  it('reuses an existing incomplete session for the day', async () => {
    mockSessionMaybeSingle.mockResolvedValue({ data: { id: 'session-existing' }, error: null })

    const response = await POST(
      makeRequest({ exerciseId: 'ex-1', setNumber: 2, repsDone: 8, loadKg: 42.5 }),
      { params: Promise.resolve({ workoutDayId: 'day-1' }) }
    )
    const body = await response.json()

    expect(mockSessionInsertSingle).not.toHaveBeenCalled()
    expect(body).toEqual({ sessionId: 'session-existing' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a rota não existe.

- [ ] **Step 3: Implementar `app/api/workout-day/[workoutDayId]/log-set/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workoutDayId: string }> }
) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day, error: dayError } = await supabase
    .from('workout_day')
    .select('id, training_plan:training_plan_id(user_id)')
    .eq('id', workoutDayId)
    .single()

  if (dayError || !day) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const ownerUserId = (day.training_plan as unknown as { user_id: string }).user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const { exerciseId, setNumber, repsDone, loadKg } = (await request.json()) as {
    exerciseId: string
    setNumber: number
    repsDone: number
    loadKg: number | null
  }

  const { data: existingSession } = await supabase
    .from('workout_session')
    .select('id')
    .eq('workout_day_id', workoutDayId)
    .eq('completed', false)
    .maybeSingle()

  let sessionId = existingSession?.id

  if (!sessionId) {
    const { data: newSession, error: sessionError } = await supabase
      .from('workout_session')
      .insert([{ user_id: userId, workout_day_id: workoutDayId, completed: false }])
      .select()
      .single()

    if (sessionError || !newSession) {
      throw new Error(sessionError?.message ?? 'Failed to create session')
    }

    sessionId = newSession.id
  }

  const { error: setError } = await supabase.from('workout_session_set').insert([
    {
      workout_session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps_done: repsDone,
      load_kg: loadKg,
    },
  ])

  if (setError) {
    throw new Error(setError.message)
  }

  return NextResponse.json({ sessionId })
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
git add app/api/workout-day/\[workoutDayId\]/log-set/route.ts app/api/workout-day/\[workoutDayId\]/log-set/route.test.ts
git commit -m "feat: add route to log an executed set"
```

---

## Task 4: Rota de finalizar o treino do dia (dispara progressão)

**Files:**
- Create: `app/api/workout-day/[workoutDayId]/finish/route.ts`
- Test: `app/api/workout-day/[workoutDayId]/finish/route.test.ts`

**Interfaces:**
- Consumes: `applyWeek1Progression` (Task 2)
- Produces: `POST /api/workout-day/:workoutDayId/finish` — marca a `workout_session` incompleta desse dia como `completed: true`. Se o dia era da semana 1 e essa foi a última sessão da semana 1 a ser concluída, chama `applyWeek1Progression`.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `app/api/workout-day/[workoutDayId]/finish/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockDayOwnerSingle = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockWeek1DaysSelect = vi.hoisted(() => vi.fn())
const mockApplyWeek1Progression = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/plan-engine/apply-progression', () => ({
  applyWeek1Progression: mockApplyWeek1Progression,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day') {
        return {
          select: (columns: string) => ({
            eq: (...args: unknown[]) => {
              if (columns.includes('training_plan')) {
                return { single: mockDayOwnerSingle }
              }
              return mockWeek1DaysSelect(...args)
            },
          }),
        }
      }
      // table === 'workout_session'
      return {
        update: () => ({
          eq: (...args: unknown[]) => {
            mockUpdateEq(...args)
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/workout-day/day-1/finish', { method: 'POST' })
}

describe('POST /api/workout-day/:workoutDayId/finish', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockDayOwnerSingle.mockReset()
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-1',
        week_number: 1,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })
    mockUpdateEq.mockClear()
    mockWeek1DaysSelect.mockReset()
    mockApplyWeek1Progression.mockClear()
  })

  it('returns 401 without a session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(response.status).toBe(401)
  })

  it('marks the session complete without triggering progression if other week-1 days remain', async () => {
    mockWeek1DaysSelect.mockResolvedValue({
      data: [
        { id: 'day-1', workout_session: [{ completed: true }] },
        { id: 'day-2', workout_session: [{ completed: false }] },
      ],
      error: null,
    })

    await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(mockApplyWeek1Progression).not.toHaveBeenCalled()
  })

  it('triggers progression once every week-1 day has a completed session', async () => {
    mockWeek1DaysSelect.mockResolvedValue({
      data: [
        { id: 'day-1', workout_session: [{ completed: true }] },
        { id: 'day-2', workout_session: [{ completed: true }] },
      ],
      error: null,
    })

    await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(mockApplyWeek1Progression).toHaveBeenCalledWith(expect.anything(), 'plan-1')
  })

  it('does not trigger progression for weeks other than 1', async () => {
    mockDayOwnerSingle.mockResolvedValue({
      data: {
        id: 'day-5',
        week_number: 2,
        training_plan_id: 'plan-1',
        training_plan: { user_id: 'user-1' },
      },
      error: null,
    })

    await POST(makeRequest(), { params: Promise.resolve({ workoutDayId: 'day-1' }) })

    expect(mockApplyWeek1Progression).not.toHaveBeenCalled()
  })
})
```

> **Nota de implementação:** assim como na Task 2, o mock deste teste é elaborado porque a rota faz múltiplas consultas com formatos parecidos. Se a estrutura do mock não bater exatamente com as chamadas do seu código, ajuste o mock livremente — o que importa é o comportamento verificado: 401 sem sessão, progressão disparada só quando (a) o dia é da semana 1 e (b) todos os dias da semana 1 têm sessão concluída.

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a rota não existe.

- [ ] **Step 3: Implementar `app/api/workout-day/[workoutDayId]/finish/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'
import { applyWeek1Progression } from '@/lib/plan-engine/apply-progression'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workoutDayId: string }> }
) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day, error: dayError } = await supabase
    .from('workout_day')
    .select('id, week_number, training_plan_id, training_plan:training_plan_id(user_id)')
    .eq('id', workoutDayId)
    .single()

  if (dayError || !day) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  const ownerUserId = (day.training_plan as unknown as { user_id: string }).user_id

  if (ownerUserId !== userId) {
    return NextResponse.json({ error: 'Workout day not found' }, { status: 404 })
  }

  await supabase
    .from('workout_session')
    .update({ completed: true })
    .eq('workout_day_id', workoutDayId)
    .eq('completed', false)

  if (day.week_number === 1) {
    const { data: week1Days } = await supabase
      .from('workout_day')
      .select('id, workout_session(completed)')
      .eq('training_plan_id', day.training_plan_id)
      .eq('week_number', 1)

    const allComplete = (week1Days ?? []).every((weekDay) =>
      (weekDay.workout_session as unknown as { completed: boolean }[]).some((s) => s.completed)
    )

    if (allComplete) {
      await applyWeek1Progression(supabase, day.training_plan_id)
    }
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
git add app/api/workout-day/\[workoutDayId\]/finish/route.ts app/api/workout-day/\[workoutDayId\]/finish/route.test.ts
git commit -m "feat: add route to finish a workout day and trigger progression"
```

---

## Task 5: Tela de execução guiada do treino

**Files:**
- Create: `app/plano/treino/[workoutDayId]/page.tsx`, `app/plano/treino/[workoutDayId]/ExecucaoGuiada.tsx`

**Interfaces:**
- Consumes: `POST /api/workout-day/:id/log-set` e `/finish` (Tasks 3-4), `createServerSupabaseClient` (Fase 1)
- Produces: rota `/plano/treino/[workoutDayId]`, mobile-first, mostra um exercício por vez com registro de série e cronômetro de descanso

- [ ] **Step 1: Criar o server component `app/plano/treino/[workoutDayId]/page.tsx`**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ExecucaoGuiada from './ExecucaoGuiada'

export default async function TreinoPage({
  params,
}: {
  params: Promise<{ workoutDayId: string }>
}) {
  const { workoutDayId } = await params
  const supabase = createServerSupabaseClient()

  const { data: day } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, rest_seconds, workout_day_exercise(id, target_sets, target_reps, target_load_kg, exercise(id, name, name_pt))'
    )
    .eq('id', workoutDayId)
    .single()

  if (!day) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p>Treino não encontrado.</p>
      </main>
    )
  }

  const exercises = (
    day.workout_day_exercise as unknown as Array<{
      id: string
      target_sets: number
      target_reps: number
      target_load_kg: number | null
      exercise: { id: string; name: string; name_pt: string | null }
    }>
  ).map((item) => ({
    id: item.id,
    exerciseId: item.exercise.id,
    name: item.exercise.name_pt ?? item.exercise.name,
    targetSets: item.target_sets,
    targetReps: item.target_reps,
    targetLoadKg: item.target_load_kg,
  }))

  return (
    <ExecucaoGuiada
      workoutDayId={day.id}
      dayLabel={day.day_label}
      restSeconds={day.rest_seconds}
      exercises={exercises}
    />
  )
}
```

- [ ] **Step 2: Criar o client component `app/plano/treino/[workoutDayId]/ExecucaoGuiada.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  exerciseId: string
  name: string
  targetSets: number
  targetReps: number
  targetLoadKg: number | null
}

export default function ExecucaoGuiada({
  workoutDayId,
  dayLabel,
  restSeconds,
  exercises,
}: {
  workoutDayId: string
  dayLabel: string
  restSeconds: number
  exercises: Exercise[]
}) {
  const router = useRouter()
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [setNumber, setSetNumber] = useState(1)
  const [reps, setReps] = useState('')
  const [load, setLoad] = useState('')
  const [resting, setResting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(restSeconds)
  const [saving, setSaving] = useState(false)

  const currentExercise = exercises[exerciseIndex]
  const isLastSetOfExercise = setNumber >= currentExercise.targetSets
  const isLastExercise = exerciseIndex >= exercises.length - 1

  useEffect(() => {
    if (!resting) {
      return
    }

    if (secondsLeft <= 0) {
      setResting(false)
      return
    }

    const timeout = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timeout)
  }, [resting, secondsLeft])

  async function saveSet() {
    setSaving(true)

    try {
      await fetch(`/api/workout-day/${workoutDayId}/log-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: currentExercise.exerciseId,
          setNumber,
          repsDone: Number(reps) || 0,
          loadKg: load ? Number(load) : null,
        }),
      })

      setReps('')
      setLoad('')

      if (isLastSetOfExercise && isLastExercise) {
        await fetch(`/api/workout-day/${workoutDayId}/finish`, { method: 'POST' })
        router.push('/plano')
        return
      }

      if (isLastSetOfExercise) {
        setExerciseIndex((i) => i + 1)
        setSetNumber(1)
      } else {
        setSetNumber((s) => s + 1)
        setResting(true)
        setSecondsLeft(restSeconds)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background px-4 py-6 text-foreground sm:px-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
          {dayLabel}
        </p>
        <h1 className="font-display text-2xl uppercase leading-none sm:text-3xl">
          {currentExercise.name}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Exercício {exerciseIndex + 1} de {exercises.length}, série {setNumber} de{' '}
          {currentExercise.targetSets}
        </p>
      </header>

      {resting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm uppercase tracking-widest text-foreground/60">Descanso</p>
          <p className="font-display text-6xl text-brand">{secondsLeft}s</p>
          <button
            type="button"
            onClick={() => setResting(false)}
            className="rounded-full border border-border-subtle px-6 py-3 text-sm font-semibold uppercase"
          >
            Pular descanso
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-foreground/60">
              Repetições feitas
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder={String(currentExercise.targetReps)}
              className="w-full rounded-xl border border-border-subtle bg-surface p-4 text-lg"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-foreground/60">
              Carga (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={load}
              onChange={(e) => setLoad(e.target.value)}
              placeholder={
                currentExercise.targetLoadKg ? String(currentExercise.targetLoadKg) : 'Livre'
              }
              className="w-full rounded-xl border border-border-subtle bg-surface p-4 text-lg"
            />
          </div>

          <button
            type="button"
            onClick={saveSet}
            disabled={saving}
            className="mt-4 w-full rounded-full bg-brand py-4 text-base font-semibold uppercase tracking-wide text-black disabled:opacity-50"
          >
            {saving ? 'Salvando...' : isLastSetOfExercise && isLastExercise ? 'Concluir treino' : 'Concluir série'}
          </button>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Grep por travessão**

Run:
```bash
grep -n "—" app/plano/treino/\[workoutDayId\]/page.tsx app/plano/treino/\[workoutDayId\]/ExecucaoGuiada.tsx
```
Expected: nenhum resultado.

- [ ] **Step 4: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`, com `/plano/treino/[workoutDayId]` listado.

- [ ] **Step 5: Commit**

```bash
git add app/plano/treino/
git commit -m "feat: add guided workout execution screen"
```

---

## Task 6: Atualizar `/plano` para navegação por semana e iniciar treino

**Files:**
- Modify: `app/plano/page.tsx`, `app/plano/PlanoInterativo.tsx`

**Interfaces:**
- Consumes: `determineCurrentWeek` (Task 1)
- Produces: `/plano` mostra só a semana atualmente desbloqueada; cada dia tem um botão "Iniciar treino" (em vez do checkbox por exercício) que leva pra `/plano/treino/[workoutDayId]`

- [ ] **Step 1: Reescrever `app/plano/page.tsx`**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
import { determineCurrentWeek } from '@/lib/plan-engine/week-progress'
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

  const { data: allDays } = await supabase
    .from('workout_day')
    .select('id, week_number, workout_session(completed)')
    .eq('training_plan_id', id)

  const weekCompletion: Record<number, boolean> = {}
  for (let week = 1; week <= 4; week++) {
    const weekDays = (allDays ?? []).filter((d) => d.week_number === week)
    weekCompletion[week] =
      weekDays.length > 0 &&
      weekDays.every((weekDay) =>
        (weekDay.workout_session as unknown as { completed: boolean }[]).some((s) => s.completed)
      )
  }

  const currentWeek = determineCurrentWeek(weekCompletion)

  const { data: days } = await supabase
    .from('workout_day')
    .select(
      'id, day_label, day_of_week, week_number, workout_day_exercise(id, target_sets, target_reps, exercise(id, name, name_pt))'
    )
    .eq('training_plan_id', id)
    .eq('week_number', currentWeek)
    .order('day_of_week')

  const formattedDays = (days ?? []).map((day) => ({
    id: day.id,
    dayLabel: translateDayLabel(day.day_label),
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

  const dayIds = formattedDays.map((day) => day.id)

  const { data: sessions } = await supabase
    .from('workout_session')
    .select('workout_day_id')
    .eq('completed', true)
    .in('workout_day_id', dayIds.length > 0 ? dayIds : [''])

  const completedDayIds = (sessions ?? []).map((session) => session.workout_day_id as string)

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Semana {currentWeek} de 4{currentWeek === 1 ? ', calibração' : ''}
        </span>
        <h1 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-5xl">
          Seu <span className="text-brand">plano</span>
        </h1>
      </header>

      <PlanoInterativo days={formattedDays} initialCompletedDayIds={completedDayIds} />
    </main>
  )
}
```

- [ ] **Step 2: Reescrever `app/plano/PlanoInterativo.tsx`**

Trocar o checkbox por exercício e o botão de trocar por: uma lista simples de exercícios (nome traduzido, imagem, séries/reps alvo, botão "Trocar" mantido) e, no lugar do checkbox, um único botão "Iniciar treino" por dia que navega pra `/plano/treino/[id]` usando `next/navigation`'s `useRouter`. Dias já concluídos (`initialCompletedDayIds`) mostram "Treino concluído" em vez do botão.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  initialCompletedDayIds = [],
}: {
  days: DayItem[]
  initialCompletedDayIds?: string[]
}) {
  const router = useRouter()
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null)
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const day of days) {
      for (const exercise of day.exercises) {
        initial[exercise.id] = exercise.name
      }
    }
    return initial
  })
  const [exerciseIds, setExerciseIds] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const day of days) {
      for (const exercise of day.exercises) {
        initial[exercise.id] = exercise.exerciseId
      }
    }
    return initial
  })
  const [swapping, setSwapping] = useState<string | null>(null)
  const completedDayIds = new Set(initialCompletedDayIds)

  async function swapExercise(workoutDayExerciseId: string) {
    setSwapping(workoutDayExerciseId)

    try {
      const response = await fetch(`/api/workout-day-exercises/${workoutDayExerciseId}/swap`, {
        method: 'POST',
      })

      if (!response.ok) {
        return
      }

      const newExercise = await response.json()
      setExerciseNames((current) => ({
        ...current,
        [workoutDayExerciseId]: newExercise.name_pt ?? newExercise.name,
      }))
      setExerciseIds((current) => ({
        ...current,
        [workoutDayExerciseId]: newExercise.id,
      }))
    } finally {
      setSwapping(null)
    }
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
              className="flex w-full items-center justify-between p-4 text-left sm:p-6"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">
                  {day.dayOfWeek ? WEEKDAY_NAMES[day.dayOfWeek] : 'Dia'}
                </p>
                <h2 className="font-display text-xl uppercase sm:text-2xl">{day.dayLabel}</h2>
              </div>
              <span aria-hidden className="text-2xl text-brand">
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle p-4 sm:p-6">
                <ul className="space-y-4">
                  {day.exercises.map((exercise) => (
                    <li
                      key={exercise.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={`/api/exercises/${exerciseIds[exercise.id]}/gif`}
                          alt={exerciseNames[exercise.id]}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                          loading="lazy"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">
                            {exerciseNames[exercise.id]}
                          </p>
                          <p className="text-xs text-foreground/60">
                            {exercise.targetSets}x{exercise.targetReps}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => swapExercise(exercise.id)}
                        disabled={swapping === exercise.id}
                        className="self-start rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50 sm:self-auto"
                      >
                        {swapping === exercise.id ? 'Trocando...' : 'Trocar'}
                      </button>
                    </li>
                  ))}
                </ul>

                {isCompleted ? (
                  <p className="mt-6 text-center text-sm text-foreground/60">Treino concluído.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/plano/treino/${day.id}`)}
                    className="mt-6 w-full rounded-full bg-brand py-4 text-sm font-semibold uppercase tracking-wide text-black"
                  >
                    Iniciar treino
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Grep por travessão**

Run:
```bash
grep -n "—" app/plano/page.tsx app/plano/PlanoInterativo.tsx
```
Expected: nenhum resultado.

- [ ] **Step 4: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/plano/page.tsx app/plano/PlanoInterativo.tsx
git commit -m "feat: navigate /plano by unlocked week, replace checkbox with guided execution"
```

---

## Task 7: Passada de responsividade em todo o app

**Files:**
- Modify: `app/page.tsx`, `app/login/page.tsx`, `app/onboarding/page.tsx`, `app/exercicios/page.tsx`

**Interfaces:**
- Produces: nenhuma mudança de comportamento, só ajustes de classes Tailwind pra telas estreitas (~375px)

- [ ] **Step 1: Revisar `app/page.tsx`**

Ler o arquivo atual. Garantir que o título (`text-6xl sm:text-8xl`) não estoure a largura em 375px — se necessário, reduzir o tamanho base (`text-5xl sm:text-8xl`) e reduzir o padding lateral em telas pequenas.

- [ ] **Step 2: Revisar `app/login/page.tsx`**

Ler o arquivo atual. Garantir que o card do formulário tenha `w-full max-w-sm` (já deve ter) e padding menor em telas pequenas (`p-6 sm:p-8` em vez de `p-8` fixo).

- [ ] **Step 3: Revisar `app/onboarding/page.tsx`**

Ler o arquivo atual. Garantir que as bolhas de chat (`max-w-[80%]`) e a área de input não estourem a largura, e que o botão "Enviar" tenha altura de toque confortável (`py-3` mínimo).

- [ ] **Step 4: Revisar `app/exercicios/page.tsx`**

Ler o arquivo atual. Garantir que o grid de exercícios comece em 2 colunas já no menor breakpoint (`grid-cols-2`, sem depender de `sm:`) pra não ficar 1 coluna gigante em celular.

- [ ] **Step 5: Build e teste manual**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

Abrir `npm run dev` e usar as ferramentas de desenvolvedor do navegador (modo responsivo, ~375px de largura) pra conferir visualmente `/`, `/login`, `/onboarding`, `/exercicios`, `/plano` e a nova tela `/plano/treino/[id]` — nenhuma reportar scroll horizontal ou texto cortado.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/login/page.tsx app/onboarding/page.tsx app/exercicios/page.tsx
git commit -m "style: pass over existing pages for mobile responsiveness"
```

---

## Fim desta fase

Ao final: o mês é navegado semana a semana, só avançando quando a semana atual estiver 100% concluída. Cada treino tem uma tela de execução guiada com cronômetro de descanso, registrando carga/reps reais. Ao fechar a semana 1 (calibração), as semanas 2-4 recebem cargas calculadas automaticamente a partir do que foi realmente levantado. Todo o app funciona bem em tela de celular.
