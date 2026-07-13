# Motor de Prescrição Avançado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a seleção "6 exercícios fixos por dia sem variedade" por um motor que pensa em volume semanal por grupo muscular (com sinergistas), respeita um catálogo de exercícios convencionais de academia com classificação composto/isolado, ordena por complexidade, prescreve RIR por nível, e exclui exercícios por restrição relatada — corrigindo os bugs de exercício repetido e conteúdo fora de contexto observados em uso real.

**Architecture:** Um catálogo estático (`lib/plan-engine/exercise-catalog.ts`) classifica exercícios por nome contra padrões conhecidos da ExerciseDB; um script aplica essa classificação aos ~1400 exercícios já sincronizados, gravando `mechanic` na tabela `exercise`. A seleção de exercícios passa a rodar por semana inteira (não mais por dia isolado): busca candidatos por dia, e uma função pura (`planWeekExercises`) distribui exercícios entre os dias evitando repetição na mesma semana e respeitando o teto de volume semanal por grupo muscular. `generate-month.ts` roda essa seleção uma vez (semana 1) e reaproveita o resultado nas semanas 2-4, preservando a consistência necessária para medir progressão de carga.

**Tech Stack:** Next.js 16 (TypeScript), Supabase (Postgres), Vitest, OpenAI SDK.

## Global Constraints

- Banco compartilhado com o CRM da AM Impulse — toda migration é aditiva (`alter table add column`), nunca `drop`/`truncate`/`reset`
- **Nunca usar travessão (—) em nenhum texto visível na interface**
- Rotas que escrevem dados usam `getAuthenticatedUserId()`, nunca confiam em `userId` do corpo da requisição
- A IA do onboarding só extrai sinais estruturados; quem decide o conteúdo do treino é sempre o motor determinístico em `lib/plan-engine/`
- Exercícios continuam os mesmos entre as semanas 1-4 do mês (progressão de carga no mesmo exercício); a variedade acontece **entre dias da mesma semana**, não entre semanas
- Paleta visual: `bg-background`/`text-foreground`/`bg-brand`/`bg-surface`/`border-border-subtle`/`font-display`

---

## Task 1: Migração — colunas novas

**Files:**
- Create: `supabase/migrations/20260713030000_add_prescription_engine_columns.sql`

**Interfaces:**
- Produces: colunas `exercise.secondary_muscles`, `exercise.mechanic`, `profile.session_minutes`, `profile.age`, `profile.sex`, `profile.training_history`, `profile.excluded_targets`, `workout_day_exercise.target_rir`

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260713030000_add_prescription_engine_columns.sql`:
```sql
alter table exercise
  add column if not exists secondary_muscles text[],
  add column if not exists mechanic text check (mechanic in ('composto', 'isolado'));

alter table profile
  add column if not exists session_minutes int,
  add column if not exists age int,
  add column if not exists sex text,
  add column if not exists training_history text,
  add column if not exists excluded_targets text[];

alter table workout_day_exercise
  add column if not exists target_rir text;
```

- [ ] **Step 2: Aplicar a migration no Supabase Cloud**

Run:
```bash
npx supabase db push
```
Expected: migration aplicada sem erros, nenhuma tabela existente é recriada ou truncada.

- [ ] **Step 3: Confirmar as colunas via consulta rápida**

Run:
```bash
npx tsx -e "
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServerSupabaseClient } from './lib/supabase/server'
;(async () => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from('exercise').select('secondary_muscles, mechanic').limit(1)
  console.log({ data, error })
})()
"
```
Expected: retorna sem erro de coluna inexistente (valores podem ser `null`, o que é esperado antes das próximas tasks).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260713030000_add_prescription_engine_columns.sql
git commit -m "feat: add columns for advanced prescription engine (secondary muscles, mechanic, RIR, extended profile)"
```

---

## Task 2: Sincronizar músculos secundários da ExerciseDB

**Files:**
- Modify: `lib/exercisedb/map.ts`
- Modify: `lib/exercisedb/map.test.ts` (se existir; caso não exista, criar)

**Interfaces:**
- Consumes: `ExerciseDbExercise.secondaryMuscles` (já existe em `lib/exercisedb/client.ts`)
- Produces: `ExerciseRow.secondary_muscles: string[]`

- [ ] **Step 1: Escrever o teste (falhando)**

Read the current `lib/exercisedb/map.test.ts` if it exists, then add this test case (adapt to the file's existing structure/imports):
```typescript
it('maps secondaryMuscles to secondary_muscles', () => {
  const row = mapToExerciseRow({
    id: 'ext-1',
    name: 'Barbell Bench Press',
    instructions: ['Step 1'],
    bodyPart: 'chest',
    equipment: 'barbell',
    target: 'pectorals',
    secondaryMuscles: ['triceps', 'delts'],
  })

  expect(row.secondary_muscles).toEqual(['triceps', 'delts'])
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test -- map.test
```
Expected: FAIL — `row.secondary_muscles` é `undefined`.

- [ ] **Step 3: Atualizar `lib/exercisedb/map.ts`**

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
  secondary_muscles: string[]
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
    secondary_muscles: exercise.secondaryMuscles,
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test -- map.test
```
Expected: PASS.

- [ ] **Step 5: Rodar o sync real pra popular a coluna nos exercícios já existentes**

Run:
```bash
npm run sync:exercises
```
Expected: log final mostrando os exercícios sincronizados (é um `upsert` por `external_id`, então atualiza as ~1400 linhas já existentes com `secondary_muscles` preenchido, sem duplicar).

- [ ] **Step 6: Confirmar que populou**

Run:
```bash
npx tsx -e "
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServerSupabaseClient } from './lib/supabase/server'
;(async () => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from('exercise').select('name, secondary_muscles').not('secondary_muscles', 'is', null).limit(3)
  console.log(JSON.stringify({ data, error }, null, 2))
})()
"
```
Expected: retorna 3 linhas com `secondary_muscles` como array não vazio (ou array vazio `[]` para exercícios sem sinergista cadastrado na ExerciseDB, mas nunca `null`).

- [ ] **Step 7: Commit**

```bash
git add lib/exercisedb/map.ts lib/exercisedb/map.test.ts
git commit -m "feat: sync secondary muscles from ExerciseDB"
```

---

## Task 3: Catálogo de exercícios convencionais + classificador

**Files:**
- Create: `lib/plan-engine/exercise-catalog.ts`, `lib/plan-engine/exercise-catalog.test.ts`

**Interfaces:**
- Produces: `type Mechanic = 'composto' | 'isolado'`, `type CatalogEntry = { namePt: string; mechanic: Mechanic; keywords: string[]; exclude?: string[] }`, `EXERCISE_CATALOG: CatalogEntry[]`, `classifyExerciseName(name: string): CatalogEntry | null`

- [ ] **Step 1: Escrever o teste (falhando)**

Create `lib/plan-engine/exercise-catalog.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { classifyExerciseName } from './exercise-catalog'

describe('classifyExerciseName', () => {
  it('classifies flat bench press as composto, not confusing it with incline', () => {
    expect(classifyExerciseName('Barbell Bench Press - Medium Grip')?.namePt).toBe('Supino reto')
    expect(classifyExerciseName('Barbell Bench Press - Medium Grip')?.mechanic).toBe('composto')
  })

  it('classifies incline bench press separately from flat', () => {
    expect(classifyExerciseName('Incline Dumbbell Press')?.namePt).toBe('Supino inclinado')
  })

  it('classifies a fly movement as isolado, distinct from press', () => {
    expect(classifyExerciseName('Incline Dumbbell Flyes')?.namePt).toBe('Crucifixo reto/inclinado')
    expect(classifyExerciseName('Incline Dumbbell Flyes')?.mechanic).toBe('isolado')
  })

  it('classifies lat pulldown as composto and straight-arm pulldown as isolado', () => {
    expect(classifyExerciseName('Wide-Grip Lat Pulldown')?.namePt).toBe('Puxada frontal')
    expect(classifyExerciseName('Wide-Grip Lat Pulldown')?.mechanic).toBe('composto')
    expect(classifyExerciseName('Straight-Arm Pulldown')?.namePt).toBe('Pulldown com corda')
    expect(classifyExerciseName('Straight-Arm Pulldown')?.mechanic).toBe('isolado')
  })

  it('classifies squat and leg extension correctly', () => {
    expect(classifyExerciseName('Barbell Full Squat')?.mechanic).toBe('composto')
    expect(classifyExerciseName('Leg Extension')?.mechanic).toBe('isolado')
  })

  it('returns null for a name matching nothing in the catalog', () => {
    expect(classifyExerciseName('Tire Flip')).toBeNull()
    expect(classifyExerciseName('Bosu Ball Balance Hold')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(classifyExerciseName('BARBELL BENCH PRESS')?.namePt).toBe('Supino reto')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test -- exercise-catalog
```
Expected: FAIL — `lib/plan-engine/exercise-catalog.ts` não existe.

- [ ] **Step 3: Implementar `lib/plan-engine/exercise-catalog.ts`**

```typescript
export type Mechanic = 'composto' | 'isolado'

export type CatalogEntry = {
  namePt: string
  mechanic: Mechanic
  keywords: string[]
  exclude?: string[]
}

export const EXERCISE_CATALOG: CatalogEntry[] = [
  // Peito
  { namePt: 'Supino inclinado', mechanic: 'composto', keywords: ['incline bench press', 'incline barbell press', 'incline dumbbell press', 'incline smith machine press'] },
  { namePt: 'Supino declinado', mechanic: 'composto', keywords: ['decline bench press', 'decline barbell press', 'decline dumbbell press', 'decline smith machine press'] },
  { namePt: 'Supino reto', mechanic: 'composto', keywords: ['bench press', 'barbell bench', 'dumbbell bench press', 'smith machine bench press'], exclude: ['incline', 'decline'] },
  { namePt: 'Flexão de braço', mechanic: 'composto', keywords: ['push-up', 'push up', 'pushup'] },
  { namePt: 'Crucifixo reto/inclinado', mechanic: 'isolado', keywords: ['fly', 'flye', 'flyes'] },
  { namePt: 'Crossover (cabo)', mechanic: 'isolado', keywords: ['crossover'] },
  { namePt: 'Peck deck (voador)', mechanic: 'isolado', keywords: ['pec deck', 'pec-deck'] },

  // Costas
  { namePt: 'Puxada por trás', mechanic: 'composto', keywords: ['behind the neck pulldown', 'behind neck pulldown'] },
  { namePt: 'Puxada frontal', mechanic: 'composto', keywords: ['lat pulldown', 'pulldown'], exclude: ['straight-arm', 'straight arm'] },
  { namePt: 'Remada baixa (cabo)', mechanic: 'composto', keywords: ['seated cable row', 'seated row', 'cable row'] },
  { namePt: 'Remada curvada (barra)', mechanic: 'composto', keywords: ['bent over row', 'bent-over row', 'barbell row'] },
  { namePt: 'Remada unilateral (halter)', mechanic: 'composto', keywords: ['one-arm dumbbell row', 'one arm row', 'single-arm row', 'dumbbell row'] },
  { namePt: 'Remada cavalinho (T-bar)', mechanic: 'composto', keywords: ['t-bar row', 't bar row'] },
  { namePt: 'Barra fixa (pull-up)', mechanic: 'composto', keywords: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chin up'] },
  { namePt: 'Pulldown com corda', mechanic: 'isolado', keywords: ['straight-arm pulldown', 'straight arm pulldown'] },
  { namePt: 'Hiperextensão lombar', mechanic: 'isolado', keywords: ['hyperextension', 'back extension'] },
  { namePt: 'Levantamento terra', mechanic: 'composto', keywords: ['deadlift'] },

  // Ombro
  { namePt: 'Desenvolvimento', mechanic: 'composto', keywords: ['shoulder press', 'overhead press', 'military press', 'arnold press'] },
  { namePt: 'Remada alta', mechanic: 'composto', keywords: ['upright row'] },
  { namePt: 'Elevação lateral', mechanic: 'isolado', keywords: ['lateral raise'] },
  { namePt: 'Elevação frontal', mechanic: 'isolado', keywords: ['front raise'] },
  { namePt: 'Crucifixo inverso', mechanic: 'isolado', keywords: ['reverse fly', 'rear delt fly', 'reverse flye'] },
  { namePt: 'Encolhimento (trapézio)', mechanic: 'isolado', keywords: ['shrug'] },

  // Bíceps
  { namePt: 'Rosca scott', mechanic: 'isolado', keywords: ['preacher curl'] },
  { namePt: 'Rosca martelo', mechanic: 'isolado', keywords: ['hammer curl'] },
  { namePt: 'Rosca concentrada', mechanic: 'isolado', keywords: ['concentration curl'] },
  { namePt: 'Rosca cabo', mechanic: 'isolado', keywords: ['cable curl'] },
  { namePt: 'Rosca alternada', mechanic: 'isolado', keywords: ['alternate dumbbell curl', 'alternating dumbbell curl'] },
  { namePt: 'Rosca direta', mechanic: 'isolado', keywords: ['barbell curl', 'ez-bar curl', 'ez bar curl', 'curl'] },

  // Tríceps
  { namePt: 'Supino fechado', mechanic: 'composto', keywords: ['close-grip bench press', 'close grip bench press'] },
  { namePt: 'Mergulho no banco (dips)', mechanic: 'composto', keywords: ['dip', 'dips'] },
  { namePt: 'Tríceps testa', mechanic: 'isolado', keywords: ['skull crusher', 'lying triceps extension', 'lying triceps press'] },
  { namePt: 'Tríceps francês', mechanic: 'isolado', keywords: ['overhead triceps extension', 'french press', 'seated triceps extension'] },
  { namePt: 'Tríceps coice', mechanic: 'isolado', keywords: ['triceps kickback', 'kickback'] },
  { namePt: 'Tríceps pulley', mechanic: 'isolado', keywords: ['triceps pushdown', 'pushdown', 'triceps rope pushdown'] },

  // Pernas - quadríceps
  { namePt: 'Agachamento no Smith', mechanic: 'composto', keywords: ['smith machine squat'] },
  { namePt: 'Agachamento livre', mechanic: 'composto', keywords: ['barbell squat', 'back squat', 'front squat', 'full squat'], exclude: ['smith'] },
  { namePt: 'Agachamento búlgaro', mechanic: 'composto', keywords: ['bulgarian split squat'] },
  { namePt: 'Hack machine', mechanic: 'composto', keywords: ['hack squat'] },
  { namePt: 'Leg press 45°', mechanic: 'composto', keywords: ['leg press'], exclude: ['calf'] },
  { namePt: 'Passada (afundo)', mechanic: 'composto', keywords: ['lunge'] },
  { namePt: 'Cadeira extensora', mechanic: 'isolado', keywords: ['leg extension'] },

  // Pernas - posterior/glúteo
  { namePt: 'Elevação pélvica (hip thrust)', mechanic: 'composto', keywords: ['hip thrust', 'glute bridge'] },
  { namePt: 'Stiff', mechanic: 'composto', keywords: ['stiff-legged deadlift', 'stiff leg deadlift'] },
  { namePt: 'Levantamento terra romeno', mechanic: 'composto', keywords: ['romanian deadlift'] },
  { namePt: 'Mesa flexora', mechanic: 'isolado', keywords: ['lying leg curl'] },
  { namePt: 'Cadeira flexora', mechanic: 'isolado', keywords: ['seated leg curl'] },
  { namePt: 'Cadeira abdutora', mechanic: 'isolado', keywords: ['hip abductor', 'abductor machine'] },
  { namePt: 'Cadeira adutora', mechanic: 'isolado', keywords: ['hip adductor', 'adductor machine'] },
  { namePt: 'Glúteo no cabo (coice)', mechanic: 'isolado', keywords: ['cable kickback', 'glute kickback'] },

  // Panturrilha
  { namePt: 'Panturrilha em pé', mechanic: 'isolado', keywords: ['standing calf raise'] },
  { namePt: 'Panturrilha sentado', mechanic: 'isolado', keywords: ['seated calf raise'] },
  { namePt: 'Panturrilha no leg press', mechanic: 'isolado', keywords: ['calf press', 'leg press calf raise'] },

  // Abdômen/core
  { namePt: 'Elevação de pernas na barra fixa', mechanic: 'composto', keywords: ['hanging leg raise'] },
  { namePt: 'Prancha isométrica', mechanic: 'composto', keywords: ['plank'] },
  { namePt: 'Abdominal na polia', mechanic: 'isolado', keywords: ['cable crunch'] },
  { namePt: 'Abdominal supra', mechanic: 'isolado', keywords: ['crunch', 'sit-up', 'sit up'] },
  { namePt: 'Abdominal infra', mechanic: 'isolado', keywords: ['leg raise'], exclude: ['hanging'] },
  { namePt: 'Rotação de tronco', mechanic: 'isolado', keywords: ['russian twist', 'oblique'] },
]

export function classifyExerciseName(name: string): CatalogEntry | null {
  const lower = name.toLowerCase()

  for (const entry of EXERCISE_CATALOG) {
    const isExcluded = (entry.exclude ?? []).some((word) => lower.includes(word))
    if (isExcluded) continue

    const matches = entry.keywords.some((keyword) => lower.includes(keyword))
    if (matches) return entry
  }

  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test -- exercise-catalog
```
Expected: PASS. Se algum caso falhar (ex.: ordem de entradas causando um match incorreto), ajuste a ordem das entradas ou os `exclude` até passar — a ordem importa porque `classifyExerciseName` retorna o primeiro match.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-engine/exercise-catalog.ts lib/plan-engine/exercise-catalog.test.ts
git commit -m "feat: add conventional gym exercise catalog with compound/isolation classification"
```

---

## Task 4: Aplicar o catálogo aos exercícios sincronizados

**Files:**
- Create: `scripts/classify-exercises.ts`

**Interfaces:**
- Consumes: `classifyExerciseName` (Task 3)
- Produces: coluna `exercise.mechanic` populada para os exercícios que casaram com o catálogo (permanece `null` para os que não casaram — esses nunca são selecionáveis por planos)

- [ ] **Step 1: Implementar `scripts/classify-exercises.ts`**

```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServerSupabaseClient } from '../lib/supabase/server'
import { classifyExerciseName } from '../lib/plan-engine/exercise-catalog'

async function main() {
  const supabase = createServerSupabaseClient()

  const allExercises: { id: string; name: string }[] = []
  let offset = 0
  const pageSize = 1000

  for (;;) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name')
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    allExercises.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`Classificando ${allExercises.length} exercícios...`)

  const matchCountByEntry: Record<string, number> = {}
  let matched = 0
  let unmatched = 0

  for (const exercise of allExercises) {
    const entry = classifyExerciseName(exercise.name)

    if (!entry) {
      unmatched += 1
      continue
    }

    matched += 1
    matchCountByEntry[entry.namePt] = (matchCountByEntry[entry.namePt] ?? 0) + 1

    const { error } = await supabase
      .from('exercise')
      .update({ mechanic: entry.mechanic })
      .eq('id', exercise.id)

    if (error) throw new Error(error.message)
  }

  console.log(`\nCasados: ${matched} | Não casados (fora do catálogo, nunca selecionáveis): ${unmatched}`)
  console.log('\nContagem por movimento do catálogo:')
  console.log(JSON.stringify(matchCountByEntry, null, 2))

  const zeroMatchEntries = Object.keys(matchCountByEntry).length
  console.log(`\nMovimentos do catálogo com pelo menos 1 exercício: ${zeroMatchEntries}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
```

- [ ] **Step 2: Rodar contra o banco real**

Run:
```bash
npx tsx scripts/classify-exercises.ts
```
Expected: log final com a contagem `Casados` / `Não casados` e a contagem por movimento do catálogo.

- [ ] **Step 3: Verificar cobertura por grupo muscular alvo**

Run:
```bash
npx tsx -e "
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServerSupabaseClient } from './lib/supabase/server'
;(async () => {
  const supabase = createServerSupabaseClient()
  const targets = ['pectorals','lats','upper back','delts','triceps','biceps','traps','quads','hamstrings','glutes','calves','abs','adductors','abductors','forearms']
  for (const target of targets) {
    const { count } = await supabase.from('exercise').select('id', { count: 'exact', head: true }).eq('target', target).not('mechanic', 'is', null)
    console.log(target, count)
  }
})()
"
```
Expected: cada grupo muscular usado pelos splits (`lib/plan-engine/split.ts`) tem pelo menos alguns exercícios com `mechanic` preenchido. Se algum grupo tiver 0 (ex.: `forearms`), volte à Task 3 e adicione palavras-chave do catálogo pra esse grupo antes de prosseguir — sem isso, dias que dependem desse grupo ficarão sem exercício algum.

- [ ] **Step 4: Ajustar o catálogo se necessário**

Se a Step 3 revelou grupos com 0 exercícios classificados, edite `lib/plan-engine/exercise-catalog.ts` (adicionando entradas/palavras-chave para cobrir esses grupos), rode `npm test -- exercise-catalog` pra confirmar que os testes existentes continuam passando, rode `npx tsx scripts/classify-exercises.ts` de novo, e repita a Step 3 até todo grupo usado pelos splits ter cobertura.

- [ ] **Step 5: Commit**

```bash
git add scripts/classify-exercises.ts
git commit -m "feat: add script to classify synced exercises against the conventional catalog"
```

(Se a Step 4 exigiu mudanças no catálogo, inclua `lib/plan-engine/exercise-catalog.ts` no mesmo commit ou num commit `fix:` separado antes deste.)

---

## Task 5: Tabela de volume semanal e RIR por nível

**Files:**
- Modify: `lib/plan-engine/volume-table.ts`
- Modify: `lib/plan-engine/volume-table.test.ts`

**Interfaces:**
- Produces: `getWeeklyVolumeRange(level: 'iniciante' | 'intermediario' | 'avancado'): { min: number; max: number }`, `getTargetRir(level: 'iniciante' | 'intermediario' | 'avancado'): string`

- [ ] **Step 1: Ler o arquivo atual**

Read `lib/plan-engine/volume-table.ts` and `lib/plan-engine/volume-table.test.ts` in full before editing, to preserve the existing `getVolumeForGoal` function and its tests unchanged.

- [ ] **Step 2: Escrever o teste (falhando)**

Add to `lib/plan-engine/volume-table.test.ts` (keep existing tests intact):
```typescript
import { getWeeklyVolumeRange, getTargetRir } from './volume-table'

describe('getWeeklyVolumeRange', () => {
  it('returns 8-12 for iniciante', () => {
    expect(getWeeklyVolumeRange('iniciante')).toEqual({ min: 8, max: 12 })
  })

  it('returns 12-16 for intermediario', () => {
    expect(getWeeklyVolumeRange('intermediario')).toEqual({ min: 12, max: 16 })
  })

  it('returns 16-20 for avancado', () => {
    expect(getWeeklyVolumeRange('avancado')).toEqual({ min: 16, max: 20 })
  })
})

describe('getTargetRir', () => {
  it('returns 2-3 for iniciante', () => {
    expect(getTargetRir('iniciante')).toBe('2-3')
  })

  it('returns 1-2 for intermediario', () => {
    expect(getTargetRir('intermediario')).toBe('1-2')
  })

  it('returns 0-2 for avancado', () => {
    expect(getTargetRir('avancado')).toBe('0-2')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test -- volume-table
```
Expected: FAIL — `getWeeklyVolumeRange` e `getTargetRir` não existem.

- [ ] **Step 4: Implementar as duas funções**

Add to `lib/plan-engine/volume-table.ts` (alongside the existing `getVolumeForGoal`, do not remove it):
```typescript
export type Level = 'iniciante' | 'intermediario' | 'avancado'

const WEEKLY_VOLUME_RANGE: Record<Level, { min: number; max: number }> = {
  iniciante: { min: 8, max: 12 },
  intermediario: { min: 12, max: 16 },
  avancado: { min: 16, max: 20 },
}

const TARGET_RIR: Record<Level, string> = {
  iniciante: '2-3',
  intermediario: '1-2',
  avancado: '0-2',
}

export function getWeeklyVolumeRange(level: Level): { min: number; max: number } {
  return WEEKLY_VOLUME_RANGE[level]
}

export function getTargetRir(level: Level): string {
  return TARGET_RIR[level]
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test -- volume-table
```
Expected: PASS (incluindo os testes já existentes de `getVolumeForGoal`, que não devem quebrar).

- [ ] **Step 6: Commit**

```bash
git add lib/plan-engine/volume-table.ts lib/plan-engine/volume-table.test.ts
git commit -m "feat: add weekly volume range and target RIR by experience level"
```

---

## Task 6: Onboarding — campos novos e exclusão estruturada por restrição

**Files:**
- Modify: `lib/openai/client.ts`
- Modify: `lib/openai/client.test.ts`
- Modify: `app/api/onboarding/chat/route.ts`
- Modify: `app/api/onboarding/chat/route.test.ts`

**Interfaces:**
- Produces: `OnboardingProfile` ganha `session_minutes: number`, `age: number`, `sex: 'masculino' | 'feminino' | 'outro'`, `training_history: string | null`, `excluded_targets: string[]`

- [ ] **Step 1: Ler os arquivos atuais**

Read `lib/openai/client.ts`, `lib/openai/client.test.ts`, `app/api/onboarding/chat/route.ts`, and `app/api/onboarding/chat/route.test.ts` in full before editing.

- [ ] **Step 2: Atualizar o teste de `chatWithTool`**

In `lib/openai/client.test.ts`, replace the `it('returns the extracted profile when the model calls completar_onboarding', ...)` test body with:
```typescript
  it('returns the extracted profile when the model calls completar_onboarding', async () => {
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 4,
      equipment: 'academia completa',
      restrictions: null,
      session_minutes: 60,
      age: 30,
      sex: 'masculino',
      training_history: 'treina há 2 anos',
      excluded_targets: [],
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
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test -- client.test
```
Expected: FAIL — o tipo `OnboardingProfile` e a ferramenta ainda não têm os campos novos.

- [ ] **Step 4: Atualizar `lib/openai/client.ts`**

```typescript
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
```

Update `SYSTEM_PROMPT`:
```typescript
const SYSTEM_PROMPT = `Você é um personal trainer conduzindo a entrevista inicial (onboarding) de um novo aluno no app Bora Treinar!. Converse naturalmente, mas pergunte EXPLICITAMENTE e confirme cada um destes pontos antes de chamar a função completar_onboarding, nunca decida um valor sem a pessoa ter respondido: objetivo (emagrecimento, hipertrofia, condicionamento ou saude_geral), nível (iniciante, intermediario ou avancado), quantos dias por semana pode treinar, quanto tempo tem disponível por sessão (em minutos), idade, sexo, um breve histórico de treino anterior, equipamento/local disponível, e se há alguma restrição física ou lesão. Se a pessoa relatar uma restrição ou lesão, traduza-a para uma lista de grupos musculares a evitar usando estritamente estes valores: pectorals, lats, upper back, delts, triceps, biceps, traps, quads, hamstrings, glutes, calves, abs, adductors, abductors, forearms, spine. Se não houver restrição, envie uma lista vazia. Nunca decida o treino em si, isso é papel de outro sistema.`
```

Update `TOOL_DEFINITION`:
```typescript
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
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test -- client.test
```
Expected: PASS.

- [ ] **Step 6: Atualizar o teste da rota de onboarding**

In `app/api/onboarding/chat/route.test.ts`, there are 3 tests that each declare their own local `profile` object with the old 5-field shape (`goal`, `level`, `days_per_week`, `equipment`, `restrictions: null`). Replace all 3 occurrences of that object literal with:
```typescript
    const profile = {
      goal: 'hipertrofia',
      level: 'iniciante',
      days_per_week: 3,
      equipment: 'academia completa',
      restrictions: null,
      session_minutes: 60,
      age: 30,
      sex: 'masculino',
      training_history: null,
      excluded_targets: [],
    }
```

Then, in the test `'saves the profile and generates the first month when onboarding completes, using the session user id'`, extend the existing assertion:
```typescript
    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ user_id: 'user-1' })])
```
to:
```typescript
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        session_minutes: 60,
        age: 30,
        sex: 'masculino',
        training_history: null,
        excluded_targets: [],
      }),
    ])
```

- [ ] **Step 7: Rodar e confirmar que falha**

Run:
```bash
npm test -- route.test
```
Expected: FAIL — a rota ainda não insere os campos novos.

- [ ] **Step 8: Atualizar `app/api/onboarding/chat/route.ts`**

```typescript
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
        session_minutes: result.profile.session_minutes,
        age: result.profile.age,
        sex: result.profile.sex,
        training_history: result.profile.training_history,
        excluded_targets: result.profile.excluded_targets,
        onboarding_transcript: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      },
    ])
    .select()
    .single()
```

- [ ] **Step 9: Rodar e confirmar que passa**

Run:
```bash
npm test -- route.test
```
Expected: PASS.

- [ ] **Step 10: Rodar a suíte inteira**

Run:
```bash
npm test
```
Expected: todos os testes passando (nenhuma regressão nos outros consumidores de `OnboardingProfile`).

- [ ] **Step 11: Commit**

```bash
git add lib/openai/client.ts lib/openai/client.test.ts app/api/onboarding/chat/route.ts app/api/onboarding/chat/route.test.ts
git commit -m "feat: collect session time, age, sex, training history, and structured exclusions in onboarding"
```

---

## Task 7: Motor de seleção semanal (volume, sinergistas, variedade, ordem)

**Files:**
- Create: `lib/plan-engine/weekly-selection.ts`, `lib/plan-engine/weekly-selection.test.ts`
- Delete: `lib/plan-engine/select-exercises.ts`, `lib/plan-engine/select-exercises.test.ts`

**Interfaces:**
- Consumes: `SplitDay` (from `lib/plan-engine/split.ts`), `Mechanic` (Task 3), `getWeeklyVolumeRange` (Task 5)
- Produces: `type CandidateExercise = { id: string; name: string; target: string; secondaryMuscles: string[]; mechanic: Mechanic }`, `planWeekExercises(candidatesByDay: CandidateExercise[][], volumeRange: { min: number; max: number }, exercisesPerDay: number): CandidateExercise[][]` (pure function), `selectExercisesForWeek(supabase, days: SplitDay[], excludedTargets: string[], volumeRange: { min: number; max: number }, exercisesPerDay: number): Promise<CandidateExercise[][]>` (DB-calling wrapper)

- [ ] **Step 1: Escrever os testes da função pura (falhando)**

Create `lib/plan-engine/weekly-selection.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { planWeekExercises, type CandidateExercise } from './weekly-selection'

function exercise(id: string, target: string, mechanic: 'composto' | 'isolado', secondaryMuscles: string[] = []): CandidateExercise {
  return { id, name: `Exercise ${id}`, target, mechanic, secondaryMuscles }
}

describe('planWeekExercises', () => {
  it('does not repeat the same exercise across different days in the same week when enough alternatives exist', () => {
    const candidatesByDay = [
      [exercise('a', 'pectorals', 'composto'), exercise('b', 'pectorals', 'composto'), exercise('c', 'pectorals', 'composto')],
      [
        exercise('a', 'pectorals', 'composto'),
        exercise('b', 'pectorals', 'composto'),
        exercise('e', 'pectorals', 'composto'),
        exercise('f', 'pectorals', 'composto'),
      ],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 2)

    expect(result[0].map((e) => e.id)).toEqual(['a', 'b'])
    expect(result[1].map((e) => e.id)).toEqual(['e', 'f'])
  })

  it('falls back to repeating within the week when there are not enough fresh candidates', () => {
    const candidatesByDay = [
      [exercise('a', 'pectorals', 'composto')],
      [exercise('a', 'pectorals', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 1)

    expect(result[0].map((e) => e.id)).toEqual(['a'])
    expect(result[1].map((e) => e.id)).toEqual(['a'])
  })

  it('orders each day compound-first', () => {
    const candidatesByDay = [
      [exercise('iso-1', 'pectorals', 'isolado'), exercise('comp-1', 'pectorals', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 8, max: 20 }, 2)

    expect(result[0].map((e) => e.id)).toEqual(['comp-1', 'iso-1'])
  })

  it('stops adding sets to a target once the weekly max is reached, counting secondary muscles as half a set, preferring an under-volume alternative', () => {
    const candidatesByDay = [
      // dia 1: pectorals com tríceps como secundário credita 0.5 em tríceps
      [exercise('d0', 'pectorals', 'composto', ['triceps'])],
      // dia 2: delts com tríceps como secundário credita mais 0.5, somando
      // 1.0 em tríceps e batendo o teto antes do dia 3
      [exercise('d1', 'delts', 'composto', ['triceps'])],
      // dia 3: o exercício de tríceps isolado (alvo principal direto) já
      // encontra tríceps no teto e é preterido a favor da alternativa de abs
      [exercise('d3', 'triceps', 'isolado'), exercise('d4', 'abs', 'composto')],
    ]

    const result = planWeekExercises(candidatesByDay, { min: 0, max: 1 }, 1)

    expect(result[0].map((e) => e.id)).toEqual(['d0'])
    expect(result[1].map((e) => e.id)).toEqual(['d1'])
    expect(result[2].map((e) => e.id)).toEqual(['d4'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test -- weekly-selection
```
Expected: FAIL — `lib/plan-engine/weekly-selection.ts` não existe.

- [ ] **Step 3: Implementar a função pura em `lib/plan-engine/weekly-selection.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SplitDay } from './split'
import type { Mechanic } from './exercise-catalog'

export type CandidateExercise = {
  id: string
  name: string
  target: string
  secondaryMuscles: string[]
  mechanic: Mechanic
}

export type VolumeRange = { min: number; max: number }

const EXCLUDED_EQUIPMENT = ['assisted', 'assisted (towel)']

export function planWeekExercises(
  candidatesByDay: CandidateExercise[][],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): CandidateExercise[][] {
  const usedSets: Record<string, number> = {}
  const usedIds = new Set<string>()
  const result: CandidateExercise[][] = []

  for (const dayCandidates of candidatesByDay) {
    const fresh = dayCandidates.filter((candidate) => !usedIds.has(candidate.id))
    const chosen: CandidateExercise[] = []

    // passo 1: só candidatos ainda não usados esta semana, respeitando o teto de volume
    for (const candidate of fresh) {
      if (chosen.length >= exercisesPerDay) break

      const currentSets = usedSets[candidate.target] ?? 0
      if (currentSets >= volumeRange.max) continue

      chosen.push(candidate)
      usedSets[candidate.target] = currentSets + 1
      for (const secondary of candidate.secondaryMuscles) {
        usedSets[secondary] = (usedSets[secondary] ?? 0) + 0.5
      }
      usedIds.add(candidate.id)
    }

    // passo 2 (fallback): ainda faltam vagas - permite repetir um exercício já
    // usado antes na semana, mas ainda respeitando o teto de volume
    if (chosen.length < exercisesPerDay) {
      for (const candidate of dayCandidates) {
        if (chosen.length >= exercisesPerDay) break
        if (chosen.some((c) => c.id === candidate.id)) continue

        const currentSets = usedSets[candidate.target] ?? 0
        if (currentSets >= volumeRange.max) continue

        chosen.push(candidate)
        usedSets[candidate.target] = currentSets + 1
        usedIds.add(candidate.id)
      }
    }

    // passo 3 (fallback final): ainda faltam vagas - ignora o teto de volume
    // também, pra nunca deixar um dia com menos exercícios do que o pedido
    if (chosen.length < exercisesPerDay) {
      for (const candidate of dayCandidates) {
        if (chosen.length >= exercisesPerDay) break
        if (chosen.some((c) => c.id === candidate.id)) continue
        chosen.push(candidate)
        usedIds.add(candidate.id)
      }
    }

    const ordered = [...chosen].sort((a, b) => {
      if (a.mechanic === b.mechanic) return 0
      return a.mechanic === 'composto' ? -1 : 1
    })

    result.push(ordered)
  }

  return result
}

export async function fetchCandidatesForDay(
  supabase: SupabaseClient,
  day: SplitDay,
  excludedTargets: string[]
): Promise<CandidateExercise[]> {
  const targets = day.targets.filter((target) => !excludedTargets.includes(target))

  if (targets.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('exercise')
    .select('id, name, target, secondary_muscles, mechanic')
    .in('target', targets)
    .not('mechanic', 'is', null)
    .not('equipment', 'in', `(${EXCLUDED_EQUIPMENT.map((e) => `"${e}"`).join(',')})`)
    .not('name', 'ilike', '%towel%')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    target: row.target as string,
    secondaryMuscles: (row.secondary_muscles as string[] | null) ?? [],
    mechanic: row.mechanic as Mechanic,
  }))
}

export async function selectExercisesForWeek(
  supabase: SupabaseClient,
  days: SplitDay[],
  excludedTargets: string[],
  volumeRange: VolumeRange,
  exercisesPerDay: number
): Promise<CandidateExercise[][]> {
  const candidatesByDay = await Promise.all(
    days.map((day) => fetchCandidatesForDay(supabase, day, excludedTargets))
  )

  return planWeekExercises(candidatesByDay, volumeRange, exercisesPerDay)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test -- weekly-selection
```
Expected: PASS.

- [ ] **Step 5: Remover o arquivo antigo `select-exercises.ts`**

Run:
```bash
grep -rn "selectExercisesForDay" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```
Expected: só aparece em `lib/plan-engine/select-exercises.ts` e `lib/plan-engine/select-exercises.test.ts` neste ponto (o único consumidor, `generate-month.ts`, é atualizado na Task 8 — se este grep já mostrar `generate-month.ts`, pule esta step e faça a remoção depois da Task 8 em vez de agora).

Delete `lib/plan-engine/select-exercises.ts` and `lib/plan-engine/select-exercises.test.ts`.

- [ ] **Step 6: Rodar a suíte inteira**

Run:
```bash
npm test
```
Expected: todos os testes passam, sem referências quebradas ao arquivo removido.

- [ ] **Step 7: Commit**

```bash
git add lib/plan-engine/weekly-selection.ts lib/plan-engine/weekly-selection.test.ts
git add lib/plan-engine/select-exercises.ts lib/plan-engine/select-exercises.test.ts
git commit -m "feat: replace per-day exercise selection with weekly volume-aware selection"
```

---

## Task 8: Rewire `generate-month.ts`

**Files:**
- Modify: `lib/plan-engine/generate-month.ts`
- Modify: `lib/plan-engine/generate-month.test.ts`

**Interfaces:**
- Consumes: `selectExercisesForWeek` (Task 7), `getWeeklyVolumeRange`, `getTargetRir` (Task 5), `OnboardingProfile.excluded_targets` (Task 6)
- Produces: `generateFirstMonth` agora usa a seleção semanal e grava `target_rir` em cada `workout_day_exercise`

- [ ] **Step 1: Ler o arquivo e o teste atuais**

Read `lib/plan-engine/generate-month.ts` and `lib/plan-engine/generate-month.test.ts` in full before editing.

- [ ] **Step 2: Atualizar o teste**

`generate-month.ts` não consulta mais a tabela `exercise` diretamente — agora chama `selectExercisesForWeek`, então o teste passa a mockar essa função (em vez de simular a query de exercícios dentro do fake do Supabase). Replace the entire content of `lib/plan-engine/generate-month.test.ts` with:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateFirstMonth } from './generate-month'
import type { OnboardingProfile } from '../openai/client'

const mockSelectExercisesForWeek = vi.hoisted(() => vi.fn())

vi.mock('./weekly-selection', () => ({
  selectExercisesForWeek: mockSelectExercisesForWeek,
}))

function makeSupabaseMock() {
  const insertedRows: Record<string, unknown[]> = {}

  function makeTable(name: string) {
    return {
      insert: (rows: unknown[]) => {
        insertedRows[name] = insertedRows[name] ?? []
        insertedRows[name].push(...rows)

        const result = { data: null, error: null }

        return {
          then: (resolve: (value: typeof result) => void) => resolve(result),
          select: () => ({
            single: async () => {
              const row = { id: `${name}-id-${insertedRows[name].length}`, ...(rows[0] as object) }
              return { data: row, error: null }
            },
          }),
        }
      },
    }
  }

  const from = vi.fn((name: string) => makeTable(name))
  return { from, insertedRows } as never
}

const BASE_PROFILE: OnboardingProfile = {
  goal: 'hipertrofia',
  level: 'iniciante',
  days_per_week: 3,
  equipment: 'academia completa',
  restrictions: null,
  session_minutes: 60,
  age: 30,
  sex: 'masculino',
  training_history: null,
  excluded_targets: ['forearms'],
}

describe('generateFirstMonth', () => {
  it('creates a training_plan and 4 weeks of workout_day reusing the same weekly exercise selection, with target_rir set', async () => {
    const supabase = makeSupabaseMock()

    // 3 days in the split (full_body for days_per_week: 3), 2 exercises each
    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([
      [{ id: 'ex-1', name: 'Exercise 1', target: 'pectorals', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-2', name: 'Exercise 2', target: 'quads', secondaryMuscles: [], mechanic: 'composto' }],
      [{ id: 'ex-3', name: 'Exercise 3', target: 'lats', secondaryMuscles: [], mechanic: 'composto' }],
    ])

    const result = await generateFirstMonth(supabase, 'user-1', BASE_PROFILE)

    expect(result.trainingPlanId).toBe('training_plan-id-1')

    // selectExercisesForWeek is called exactly once (not once per week), with excluded_targets forwarded
    expect(mockSelectExercisesForWeek).toHaveBeenCalledTimes(1)
    expect(mockSelectExercisesForWeek).toHaveBeenCalledWith(
      supabase,
      expect.any(Array),
      ['forearms'],
      expect.any(Object),
      expect.any(Number)
    )

    // days_per_week: 3 -> full_body split -> 3 days/week * 4 weeks = 12 workout_day rows
    expect(supabase.insertedRows.workout_day).toHaveLength(12)

    const weekNumbers = (supabase.insertedRows.workout_day as { week_number: number }[]).map(
      (row) => row.week_number
    )
    expect(weekNumbers.filter((w) => w === 1)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 2)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 3)).toHaveLength(3)
    expect(weekNumbers.filter((w) => w === 4)).toHaveLength(3)

    // 12 workout_day rows * 1 exercise (per the mocked weekly selection) = 12 rows,
    // and every week reuses the SAME exercise id per day position (day 1 always ex-1, etc)
    const dayExercises = supabase.insertedRows.workout_day_exercise as {
      exercise_id: string
      target_load_kg: number | null
      target_rir: string
    }[]
    expect(dayExercises).toHaveLength(12)
    expect(dayExercises.every((row) => row.target_load_kg === null)).toBe(true)
    expect(dayExercises.every((row) => row.target_rir === '2-3')).toBe(true)

    const exerciseIdsByPosition = [0, 1, 2].map(
      (dayIndex) => dayExercises.filter((_, i) => i % 3 === dayIndex).map((r) => r.exercise_id)
    )
    expect(exerciseIdsByPosition[0].every((id) => id === 'ex-1')).toBe(true)
    expect(exerciseIdsByPosition[1].every((id) => id === 'ex-2')).toBe(true)
    expect(exerciseIdsByPosition[2].every((id) => id === 'ex-3')).toBe(true)
  })

  it('throws when the training_plan insert fails', async () => {
    mockSelectExercisesForWeek.mockReset()
    mockSelectExercisesForWeek.mockResolvedValue([[], [], []])

    const failingSupabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'insert failed' } }),
          }),
        }),
      }),
    } as never

    await expect(generateFirstMonth(failingSupabase, 'user-1', BASE_PROFILE)).rejects.toThrow(
      'insert failed'
    )
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test -- generate-month
```
Expected: FAIL — `generate-month.ts` ainda chama a função antiga.

- [ ] **Step 4: Atualizar `lib/plan-engine/generate-month.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingProfile } from '../openai/client'
import { chooseSplit } from './split'
import { selectExercisesForWeek } from './weekly-selection'
import { getVolumeForGoal, getWeeklyVolumeRange, getTargetRir } from './volume-table'
import { assignWeekdays } from './weekdays'

export async function generateFirstMonth(
  supabase: SupabaseClient,
  userId: string,
  profile: OnboardingProfile
): Promise<{ trainingPlanId: string }> {
  const split = chooseSplit(profile.days_per_week)
  const volume = getVolumeForGoal(profile.goal)
  const volumeRange = getWeeklyVolumeRange(profile.level)
  const targetRir = getTargetRir(profile.level)
  const weekdays = assignWeekdays(profile.days_per_week)

  const weekSelection = await selectExercisesForWeek(
    supabase,
    split.days,
    profile.excluded_targets,
    volumeRange,
    volume.exercisesPerDay
  )

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

  const [minReps] = volume.reps.split('-').map(Number)

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

      if (dayError) {
        throw new Error(dayError.message)
      }

      const exercises = weekSelection[dayIndex]

      const dayExerciseRows = exercises.map((exercise, index) => ({
        workout_day_id: workoutDay.id,
        exercise_id: exercise.id,
        order_index: index,
        target_sets: volume.sets,
        target_reps: minReps,
        target_load_kg: null,
        target_rir: targetRir,
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

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
npm test -- generate-month
```
Expected: PASS.

- [ ] **Step 6: Remover `select-exercises.ts` se ainda não removido**

Se a Task 7 pulou a remoção porque `generate-month.ts` ainda referenciava o arquivo antigo, delete `lib/plan-engine/select-exercises.ts` e `lib/plan-engine/select-exercises.test.ts` agora.

- [ ] **Step 7: Rodar a suíte inteira e o build**

Run:
```bash
npm test && npm run build
```
Expected: todos os testes passam, build compila sem erros.

- [ ] **Step 8: Commit**

```bash
git add lib/plan-engine/generate-month.ts lib/plan-engine/generate-month.test.ts
git add lib/plan-engine/select-exercises.ts lib/plan-engine/select-exercises.test.ts
git commit -m "feat: rewire month generation to use weekly volume-aware selection and prescribe RIR"
```

---

## Task 9: Exibir RIR na tela de execução guiada

**Files:**
- Modify: `app/plano/treino/[workoutDayId]/page.tsx`
- Modify: `app/plano/treino/[workoutDayId]/ExecucaoGuiada.tsx`

**Interfaces:**
- Produces: a tela de execução guiada mostra o RIR alvo junto com séries/reps

- [ ] **Step 1: Ler os arquivos atuais**

Read both files in full before editing.

- [ ] **Step 2: Atualizar a consulta em `page.tsx`**

In the `select(...)` call for `workout_day_exercise`, add `target_rir` to the selected columns, and in the `.map(...)` that builds the `exercises` array passed to `ExecucaoGuiada`, add a `targetRir: item.target_rir as string | null` field alongside the existing `targetSets`/`targetReps`/`targetLoadKg` fields.

- [ ] **Step 3: Atualizar `ExecucaoGuiada.tsx`**

Add `targetRir: string | null` to the `Exercise` type, and render it next to the existing sets/reps info — find the header block showing `Exercício {exerciseIndex + 1} de {exercises.length}, série {setNumber} de {currentExercise.targetSets}` and add a line below it:
```tsx
{currentExercise.targetRir && (
  <p className="mt-1 text-xs uppercase tracking-widest text-brand">
    RIR alvo: {currentExercise.targetRir}
  </p>
)}
```

- [ ] **Step 4: Grep por travessão**

Run:
```bash
grep -n "—" "app/plano/treino/[workoutDayId]/page.tsx" "app/plano/treino/[workoutDayId]/ExecucaoGuiada.tsx"
```
Expected: nenhum resultado.

- [ ] **Step 5: Build**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add "app/plano/treino/[workoutDayId]/page.tsx" "app/plano/treino/[workoutDayId]/ExecucaoGuiada.tsx"
git commit -m "feat: display target RIR in the guided execution screen"
```

---

## Fim desta fase

Ao final: o onboarding coleta tempo por sessão, idade, sexo e histórico, e traduz restrições relatadas em exclusões estruturadas de grupo muscular. A seleção de exercícios respeita um catálogo de movimentos convencionais de academia (nada de equipamento incomum), soma volume semanal por grupo muscular contando sinergistas, varia exercícios entre os dias da mesma semana mas mantém consistência entre as semanas do mês, ordena por complexidade (composto antes de isolado), e prescreve RIR por nível — exibido na tela de execução guiada.
