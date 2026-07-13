# Ajustes no Plano de Treino (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de testar o app de verdade, o usuário pediu 4 ajustes: (1) planos já gerados antes da tradução ainda mostram "Push/Pull/Legs" em inglês, (2) exercícios que precisam de toalha/assistência sem máquina não fazem sentido pra treino de academia, (3) precisa de um botão pra trocar um exercício específico, (4) o check de conclusão deve ser por exercício (não só um botão pro dia inteiro), completando o dia automaticamente quando todos os exercícios forem marcados.

**Architecture:** Função pura de tradução de labels legados (aplicada na exibição, sem precisar migrar dados antigos). Filtro adicional na seleção de exercícios excluindo equipamento "assisted"/"assisted (towel)" e nomes contendo "towel". Nova rota `POST /api/workout-day-exercises/[id]/swap` que troca um exercício por outro do mesmo grupo muscular, ainda não usado no mesmo dia. `PlanoInterativo.tsx` ganha checkbox por exercício (estado local) que, quando todos ficam marcados, chama a rota de conclusão do dia já existente.

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — só migrations aditivas, nunca `db reset`/`drop`/`truncate` (esta fase não deve precisar de nenhuma migration nova)
- **Nunca usar travessão (—) em nenhum texto visível na interface**
- Paleta visual: `bg-background`/`text-foreground`/`bg-brand`/`bg-surface`/`border-border-subtle`/`font-display`
- Rotas que escrevem dados devem usar `getAuthenticatedUserId()` (nunca confiar em `userId` do corpo da requisição) — mesma regra já aplicada nas Fases anteriores
- **Escopo do check por exercício:** o estado de "exercício marcado" é local (client-side), não persiste entre recarregamentos — só a conclusão do dia inteiro persiste (via `workout_session`, já existente). Tracking detalhado de séries/reps reais por exercício é uma fase futura (execução guiada completa).
- **Escopo da troca de exercício:** troca só o exercício da semana 1 (a única semana exibida em `/plano` hoje) — não propaga pras semanas 2-4 do mesmo mês, já que a lógica de progressão entre semanas ainda não está conectada (Fase 3, Task 6)

---

## Task 1: Traduzir labels de treinos já gerados (dados legados)

**Files:**
- Create: `lib/plan-engine/label-i18n.ts`, `lib/plan-engine/label-i18n.test.ts`
- Modify: `app/plano/page.tsx`

**Interfaces:**
- Produces: `translateDayLabel(label: string): string` — traduz labels em inglês de planos gerados antes da localização (Fase de Melhorias, Task 2); labels já em português passam direto

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/label-i18n.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { translateDayLabel } from './label-i18n'

describe('translateDayLabel', () => {
  it('translates legacy English split labels', () => {
    expect(translateDayLabel('Push')).toBe('Empurrar')
    expect(translateDayLabel('Pull')).toBe('Puxar')
    expect(translateDayLabel('Legs')).toBe('Pernas')
    expect(translateDayLabel('Upper')).toBe('Superior')
    expect(translateDayLabel('Lower')).toBe('Inferior')
  })

  it('translates legacy "Full Body N" labels preserving the number', () => {
    expect(translateDayLabel('Full Body 1')).toBe('Corpo Inteiro 1')
    expect(translateDayLabel('Full Body 3')).toBe('Corpo Inteiro 3')
  })

  it('passes through labels that are already in Portuguese', () => {
    expect(translateDayLabel('Empurrar')).toBe('Empurrar')
    expect(translateDayLabel('Corpo Inteiro 2')).toBe('Corpo Inteiro 2')
  })

  it('passes through unrecognized labels unchanged', () => {
    expect(translateDayLabel('Dia Especial')).toBe('Dia Especial')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `lib/plan-engine/label-i18n.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/label-i18n.ts`**

```typescript
const DIRECT_TRANSLATIONS: Record<string, string> = {
  Push: 'Empurrar',
  Pull: 'Puxar',
  Legs: 'Pernas',
  Upper: 'Superior',
  Lower: 'Inferior',
}

const FULL_BODY_PATTERN = /^Full Body (\d+)$/

export function translateDayLabel(label: string): string {
  if (DIRECT_TRANSLATIONS[label]) {
    return DIRECT_TRANSLATIONS[label]
  }

  const fullBodyMatch = label.match(FULL_BODY_PATTERN)
  if (fullBodyMatch) {
    return `Corpo Inteiro ${fullBodyMatch[1]}`
  }

  return label
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Aplicar em `app/plano/page.tsx`**

Adicionar o import:
```typescript
import { translateDayLabel } from '@/lib/plan-engine/label-i18n'
```

Na montagem de `formattedDays`, trocar `dayLabel: day.day_label,` por:
```typescript
    dayLabel: translateDayLabel(day.day_label),
```

- [ ] **Step 6: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add lib/plan-engine/label-i18n.ts lib/plan-engine/label-i18n.test.ts app/plano/page.tsx
git commit -m "feat: translate legacy English day labels for display"
```

---

## Task 2: Excluir exercícios que exigem assistência/toalha

**Files:**
- Modify: `lib/plan-engine/select-exercises.ts`, `lib/plan-engine/select-exercises.test.ts`

**Interfaces:**
- Produces: `selectExercisesForDay` continua com a mesma assinatura, mas nunca retorna exercícios com `equipment` em `('assisted', 'assisted (towel)')` nem `name` contendo "towel"

> **Contexto (dados reais consultados antes de escrever este plano):** 15 exercícios têm `equipment = 'assisted'` e 1 tem `'assisted (towel)'` (ex: "assisted standing triceps extension (with towel)") — precisam de assistência manual ou toalha, sem usar máquina real. Outros 4 exercícios têm `equipment = 'body weight'` mas o nome menciona "towel" (ex: "bodyweight standing row (with towel)"). Exercícios "assisted" com `equipment = 'leverage machine'` (ex: assisted pull-up, assisted dip) usam uma máquina de verdade e **devem continuar** disponíveis — não filtrar por nome conter "assist", só pelos dois critérios acima.

- [ ] **Step 1: Reescrever o mock e o teste (falhando)**

Modify `lib/plan-engine/select-exercises.test.ts`. O real `PostgrestFilterBuilder` do Supabase retorna a própria instância (`this`) em todo método de filtro (`.in`, `.not`, `.eq`), então o mock não precisa modelar uma ordem rígida de encadeamento — um único objeto espião com todos os métodos, cada um retornando a si mesmo, resolve o problema de forma realista. Substituir `makeSupabaseMock` inteiro por:

```typescript
function makeSupabaseMock(rows: { id: string; name: string }[]) {
  const calls: { method: string; args: unknown[] }[] = []

  const builder = {
    in: (...args: unknown[]) => {
      calls.push({ method: 'in', args })
      return builder
    },
    not: (...args: unknown[]) => {
      calls.push({ method: 'not', args })
      return builder
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: 'eq', args })
      return builder
    },
    limit: (...args: unknown[]) => {
      calls.push({ method: 'limit', args })
      return Promise.resolve({ data: rows, error: null })
    },
  }

  const select = vi.fn().mockReturnValue(builder)
  const from = vi.fn().mockReturnValue({ select })
  return { from, select, calls } as never
}
```

Adicionar o novo teste depois do teste de filtro de equipamento existente (que agora lê `supabase.calls` em vez dos spies antigos — ajustar suas asserções existentes de `toHaveBeenCalledWith` no mock antigo para checar `supabase.calls` da mesma forma, ex: `expect(supabase.calls).toContainEqual({ method: 'in', args: ['target', ['chest']] })`):

```typescript
  it('excludes exercises that require manual assistance or a towel', async () => {
    const supabase = makeSupabaseMock([])

    await selectExercisesForDay(supabase, { label: 'Push', targets: ['chest'] }, null, 5)

    expect(supabase.calls).toContainEqual({
      method: 'not',
      args: ['equipment', 'in', '("assisted","assisted (towel)")'],
    })
    expect(supabase.calls).toContainEqual({
      method: 'not',
      args: ['name', 'ilike', '%towel%'],
    })
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a query ainda não exclui esses equipamentos/nomes.

- [ ] **Step 3: Atualizar `lib/plan-engine/select-exercises.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']

export async function selectExercisesForDay(
  supabase: SupabaseClient,
  day: SplitDay,
  equipmentFilter: string | null,
  count: number
): Promise<{ id: string; name: string }[]> {
  let query = supabase
    .from('exercise')
    .select('id, name')
    .in('target', day.targets)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')

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
git commit -m "feat: exclude assisted/towel exercises from gym workout selection"
```

---

## Task 3: Rota de trocar exercício

**Files:**
- Create: `app/api/workout-day-exercises/[id]/swap/route.ts`
- Test: `app/api/workout-day-exercises/[id]/swap/route.test.ts`

**Interfaces:**
- Produces: `POST /api/workout-day-exercises/:id/swap` — troca o `exercise_id` do `workout_day_exercise` de id `:id` por outro exercício do mesmo `target`, ainda não usado no mesmo `workout_day`, respeitando as mesmas exclusões da Task 2. Retorna `{ id: string; name: string; name_pt: string | null }` do novo exercício.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `app/api/workout-day-exercises/[id]/swap/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
const mockCurrentSingle = vi.hoisted(() => vi.fn())
const mockUsedSelect = vi.hoisted(() => vi.fn())
const mockCandidateLimit = vi.hoisted(() => vi.fn())
const mockUpdateEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@/lib/supabase/session', () => ({ getAuthenticatedUserId: mockGetAuthenticatedUserId }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'workout_day_exercise') {
        return {
          select: (columns: string) => {
            if (columns.includes('exercise:exercise_id')) {
              return { eq: () => ({ single: mockCurrentSingle }) }
            }
            return { eq: () => mockUsedSelect() }
          },
          update: () => ({ eq: mockUpdateEq }),
        }
      }
      // table === 'exercise'
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              not: () => ({
                not: () => ({ limit: mockCandidateLimit }),
              }),
            }),
          }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

describe('POST /api/workout-day-exercises/:id/swap', () => {
  beforeEach(() => {
    mockGetAuthenticatedUserId.mockReset()
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
    mockCurrentSingle.mockReset()
    mockUsedSelect.mockReset()
    mockCandidateLimit.mockReset()
    mockUpdateEq.mockClear()
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockGetAuthenticatedUserId.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('swaps to a different exercise with the same target', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { id: 'wde-1', workout_day_id: 'day-1', exercise_id: 'ex-1', exercise: { target: 'pectorals' } },
      error: null,
    })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidateLimit.mockResolvedValue({
      data: [{ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' }],
      error: null,
    })

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })
    const body = await response.json()

    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'wde-1')
    expect(body).toEqual({ id: 'ex-2', name: 'Bench Press', name_pt: 'Supino Reto' })
  })

  it('returns an error when no alternative exercise is available', async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { id: 'wde-1', workout_day_id: 'day-1', exercise_id: 'ex-1', exercise: { target: 'pectorals' } },
      error: null,
    })
    mockUsedSelect.mockResolvedValue({ data: [{ exercise_id: 'ex-1' }], error: null })
    mockCandidateLimit.mockResolvedValue({ data: [], error: null })

    const response = await POST(new Request('http://localhost/api/workout-day-exercises/wde-1/swap', { method: 'POST' }), {
      params: Promise.resolve({ id: 'wde-1' }),
    })

    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — a rota não existe.

- [ ] **Step 3: Implementar `app/api/workout-day-exercises/[id]/swap/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from '@/lib/supabase/session'

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: current, error: currentError } = await supabase
    .from('workout_day_exercise')
    .select('id, workout_day_id, exercise_id, exercise:exercise_id(target)')
    .eq('id', id)
    .single()

  if (currentError || !current) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  const { data: usedRows } = await supabase
    .from('workout_day_exercise')
    .select('exercise_id')
    .eq('workout_day_id', current.workout_day_id)

  const usedIds = (usedRows ?? []).map((row) => row.exercise_id)
  const target = (current.exercise as unknown as { target: string }).target

  const { data: candidates, error: candidateError } = await supabase
    .from('exercise')
    .select('id, name, name_pt')
    .eq('target', target)
    .not('id', 'in', `(${usedIds.join(',')})`)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')
    .limit(1)

  if (candidateError) {
    throw new Error(candidateError.message)
  }

  const candidate = candidates?.[0]

  if (!candidate) {
    return NextResponse.json({ error: 'No alternative exercise available' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('workout_day_exercise')
    .update({ exercise_id: candidate.id })
    .eq('id', id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return NextResponse.json(candidate)
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
git add app/api/workout-day-exercises/\[id\]/swap/route.ts app/api/workout-day-exercises/\[id\]/swap/route.test.ts
git commit -m "feat: add exercise swap route"
```

---

## Task 4: Botão de trocar exercício e checkbox por exercício na UI

**Files:**
- Modify: `app/plano/PlanoInterativo.tsx`

**Interfaces:**
- Produces: cada exercício ganha um botão "Trocar" (chama a rota da Task 3 e atualiza o nome exibido) e um checkbox (estado local); quando todos os checkboxes de um dia ficam marcados, chama automaticamente `/api/workout-sessions/complete` pra esse dia

- [ ] **Step 1: Reescrever `app/plano/PlanoInterativo.tsx`**

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
  initialCompletedDayIds = [],
}: {
  days: DayItem[]
  initialCompletedDayIds?: string[]
}) {
  const [openDayId, setOpenDayId] = useState<string | null>(days[0]?.id ?? null)
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(
    new Set(initialCompletedDayIds)
  )
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const day of days) {
      for (const exercise of day.exercises) {
        initial[exercise.id] = exercise.name
      }
    }
    return initial
  })
  const [checkedExerciseIds, setCheckedExerciseIds] = useState<Set<string>>(new Set())
  const [swapping, setSwapping] = useState<string | null>(null)

  async function completeDay(dayId: string) {
    await fetch('/api/workout-sessions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutDayId: dayId }),
    })
    setCompletedDayIds((current) => new Set(current).add(dayId))
  }

  function toggleExercise(day: DayItem, exerciseItemId: string) {
    setCheckedExerciseIds((current) => {
      const next = new Set(current)
      if (next.has(exerciseItemId)) {
        next.delete(exerciseItemId)
      } else {
        next.add(exerciseItemId)
      }

      const allChecked = day.exercises.every((exercise) => next.has(exercise.id))
      if (allChecked && !completedDayIds.has(day.id)) {
        completeDay(day.id)
      }

      return next
    })
  }

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
                  {day.exercises.map((exercise) => {
                    const isChecked = checkedExerciseIds.has(exercise.id)

                    return (
                      <li key={exercise.id} className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleExercise(day, exercise.id)}
                          className="h-5 w-5 accent-[var(--brand)]"
                        />
                        <img
                          src={`/api/exercises/${exercise.exerciseId}/gif`}
                          alt={exerciseNames[exercise.id]}
                          className="h-16 w-16 rounded-lg object-cover"
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
                        <button
                          type="button"
                          onClick={() => swapExercise(exercise.id)}
                          disabled={swapping === exercise.id}
                          className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 disabled:opacity-50"
                        >
                          {swapping === exercise.id ? 'Trocando...' : 'Trocar'}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-6 text-center text-sm text-foreground/60">
                  {isCompleted
                    ? 'Treino concluído.'
                    : 'Marque todos os exercícios para concluir o treino do dia.'}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Grep por travessão**

Run:
```bash
grep -n "—" app/plano/PlanoInterativo.tsx
```
Expected: nenhum resultado.

- [ ] **Step 3: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add app/plano/PlanoInterativo.tsx
git commit -m "feat: add per-exercise checkbox (auto-completes day) and swap button"
```

---

## Fim desta fase

Ao final: labels de planos antigos aparecem em português, exercícios que exigem toalha/assistência manual somem do catálogo de seleção, cada exercício tem um botão pra trocar por outro do mesmo grupo muscular, e marcar todos os exercícios de um dia completa o treino automaticamente.
