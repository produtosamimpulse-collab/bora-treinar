# Fundação — Bora Treinar! Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter o esqueleto do app "Bora Treinar!" rodando localmente: projeto Next.js configurado, schema completo do banco no Supabase, autenticação por email/senha funcionando, e o tema visual (fundo claro, texto preto, detalhes verde água) aplicado no layout base.

**Architecture:** Next.js (App Router, TypeScript) hospedado na Vercel, com Supabase como banco Postgres + Auth. Testes com Vitest rodando contra o projeto Supabase Cloud (hospedado) linkado via CLI — não local/Docker (revisto após a Task 3: a máquina de desenvolvimento não tinha espaço em disco para o stack local do Supabase). Migrations SQL versionadas em `supabase/migrations/` e aplicadas via `supabase db push`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Supabase CLI, Vitest.

## Global Constraints

- Autenticação: Supabase Auth, login por email/senha (sem OAuth, sem cadastro público — usuário único hoje)
- Banco: Postgres via **Supabase Cloud** (projeto hospedado, não local/Docker), schema versionado em `supabase/migrations/`
- **Banco compartilhado:** o projeto Supabase (`miauzaadeykvjjwmjvnd`) já hospeda o CRM da AM Impulse (tabelas como `client_contracts`, `financial_records`, `colaboradores`) — é o mesmo projeto por decisão do usuário (evitar custo de um projeto pago). Regras por causa disso:
  - **Nunca** rodar `supabase db reset`, `drop table`, `truncate` ou qualquer comando destrutivo contra este projeto — só migrations aditivas via `supabase db push`
  - Toda tabela nova do Bora Treinar! deve ter Row Level Security (RLS) habilitada, isolando os dados por dono (`auth.uid()`), já que a mesma anon/service_role key é usada pelos dois sistemas
  - Nomes de tabela não podem colidir com os já existentes no schema `public` (checar antes de criar: `agency_expenses`, `alerts`, `anuncios`, `aprovacao_comentarios`, `aprovacoes`, `arquivos`, `avisos`, `calendario`, `client_contracts`, `cliente_servicos`, `colaboradores`, `controle_acesso_checktruck`, `crm`, `financial_records`, `metricas_mensais`, `onboarding`, `posts`, `profiles`, `tarefas`)
- Deploy: Vercel
- Paleta visual: fundo claro (`#FFFFFF` / `#F7FAF9`), texto preto (`#0A0A0A`), cor de destaque verde água (`#2DD4BF`)
- Sem nutrição, sem multi-tenant/billing, sem wearables, sem fotos de progresso (fora de escopo do produto inteiro, não só desta fase)

---

## Task 1: Scaffold do projeto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`

**Interfaces:**
- Produces: projeto Next.js executável via `npm run dev`, com Tailwind configurado e pronto para receber a paleta de cores.

- [ ] **Step 1: Criar o projeto Next.js**

Run:
```bash
cd /Users/adelyne/bora-treinar
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --yes
```
Expected: cria `package.json`, `app/`, `tailwind.config.ts`, etc. no diretório atual (o comando detecta que a pasta já tem `.git` e `docs/` e pergunta se pode continuar — confirme com `y` se solicitado).

- [ ] **Step 2: Verificar que o projeto builda e roda**

Run:
```bash
npm run build
```
Expected: build finaliza com `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with TypeScript and Tailwind"
```

---

## Task 2: Configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (adicionar script `test`)
- Test: `lib/sanity.test.ts`

**Interfaces:**
- Consumes: projeto Next.js do Task 1
- Produces: comando `npm test` rodando Vitest

- [ ] **Step 1: Instalar dependências de teste**

Run:
```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```
Expected: instala sem erro, adiciona entradas em `package.json`.

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 3: Adicionar script de teste no `package.json`**

No `"scripts"` de `package.json`, adicionar:
```json
"test": "vitest run"
```

- [ ] **Step 4: Escrever um teste de sanidade (falhando)**

Create `lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('confirms the test runner works', () => {
    expect(1 + 1).toBe(3)
  })
})
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `expected 2 to be 3`.

- [ ] **Step 6: Corrigir o teste**

Edit `lib/sanity.test.ts`, trocar `toBe(3)` por `toBe(2)`.

- [ ] **Step 7: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS — 1 teste passou.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest test runner"
```

---

## Task 3: Conectar a um projeto Supabase Cloud

> **Nota de implementação (atualizado após tentativa da Task 3):** a máquina de desenvolvimento não tem espaço em disco suficiente para rodar o Supabase local via Docker (`supabase start` falhou por disco cheio, e o Docker Desktop ficou instável). Em vez de Supabase local, este projeto usa um projeto Supabase Cloud (hospedado) desde o início do desenvolvimento — sem dependência de Docker. Os Steps 1-2 abaixo (instalar CLI, `supabase init`) já foram concluídos numa tentativa anterior e não precisam ser refeitos; o `git status` confirma `package.json`/`package-lock.json` modificados e a pasta `supabase/` (com `config.toml`) já presente e não commitada.
>
> **Pré-requisito humano (feito fora deste plano, no navegador):** um projeto foi criado em https://supabase.com/dashboard (nome `bora-treinar`), com a senha do banco definida na criação. As credenciais (Project URL, anon key, service_role key, connection string) foram fornecidas pelo usuário para uso nos passos abaixo.

**Files:**
- Create (já feito): `supabase/config.toml`, `supabase/.gitignore` (gerados pelo CLI)
- Create: `.env.local`, `.env.test`
- Modify: `vitest.config.ts` (carregar `.env.test`)

**Interfaces:**
- Consumes: credenciais do projeto Supabase Cloud (fornecidas pelo usuário)
- Produces: CLI linkada ao projeto remoto; `.env.local`/`.env.test` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`; `vitest.config.ts` carregando `.env.test` para todos os testes (usado a partir do Task 4)

- [x] **Step 1: Instalar Supabase CLI como dependência de dev** — já feito (`npm install -D supabase`)

- [x] **Step 2: Inicializar o projeto Supabase** — já feito (`npx supabase init`, criou `supabase/config.toml`)

- [ ] **Step 3: Autenticar a CLI do Supabase**

Run:
```bash
npx supabase login
```
Expected: abre o navegador para autenticar e imprime confirmação de login. (Alternativa não-interativa, se preferir: gerar um access token em https://supabase.com/dashboard/account/tokens e rodar `npx supabase login --token <TOKEN>`.)

- [ ] **Step 4: Linkar o projeto remoto**

O `project-ref` aparece na URL do dashboard do projeto: `https://supabase.com/dashboard/project/<PROJECT_REF>`.

Run:
```bash
npx supabase link --project-ref <PROJECT_REF>
```
Expected: pede a senha do banco (definida na criação do projeto) e confirma o link com `Finished supabase link`.

- [ ] **Step 5: Salvar as credenciais em `.env.local` e `.env.test`**

Em Project Settings → Data API, copiar a Project URL e a anon public key. Em Project Settings → API Keys, copiar a service_role key. Em Project Settings → Database → Connection string, copiar a URI no modo "Session pooler".

Criar `.env.local` na raiz:
```bash
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Criar `.env.test` na raiz (usado pelos testes a partir do Task 4):
```bash
SUPABASE_URL=<Project URL>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_DB_URL=<connection string URI, modo Session pooler>
```

- [ ] **Step 6: Garantir que os `.env*` locais não vão pro git**

Confirmar que `.gitignore` contém a linha `.env*` (já existe, adicionada pelo `create-next-app` — nenhuma alteração deveria ser necessária; se não existir, adicionar `.env.local` e `.env.test` explicitamente).

- [ ] **Step 7: Carregar `.env.test` no Vitest**

Run:
```bash
npm install -D dotenv
```

Modify `vitest.config.ts` para ler o `.env.test` antes de qualquer teste:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 8: Confirmar a conexão com o projeto remoto**

Run:
```bash
npx supabase migration list
```
Expected: imprime uma tabela comparando migrations locais vs. remotas (vazia dos dois lados neste ponto, já que ainda não criamos nenhuma) sem erro de conexão/autenticação. Um erro aqui indica credenciais erradas no link (Step 4) — não prosseguir sem essa confirmação.

- [ ] **Step 9: Commit**

```bash
git add supabase/config.toml supabase/.gitignore vitest.config.ts package.json package-lock.json
git commit -m "chore: connect project to Supabase Cloud"
```

---

## Task 4: Migration com o schema completo do banco

**Files:**
- Create: `supabase/migrations/20260712000000_initial_schema.sql`
- Test: `lib/supabase/schema.test.ts`

**Interfaces:**
- Consumes: projeto Supabase Cloud linkado no Task 3 (`.env.test`, variável `SUPABASE_DB_URL`), `vitest.config.ts` já carregando `.env.test`
- Produces: tabelas `profile`, `exercise`, `training_plan`, `workout_day`, `workout_day_exercise`, `workout_session`, `workout_session_set`, `monthly_checkin`, `body_metric` no Postgres remoto

- [ ] **Step 1: Instalar cliente Postgres para o teste de schema**

Run:
```bash
npm install -D pg @types/pg
```

- [ ] **Step 2: Escrever o teste de schema (falhando)**

Create `lib/supabase/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

const EXPECTED_TABLES = [
  'profile',
  'exercise',
  'training_plan',
  'workout_day',
  'workout_day_exercise',
  'workout_session',
  'workout_session_set',
  'monthly_checkin',
  'body_metric',
]

describe('database schema', () => {
  it('creates all expected tables', async () => {
    const connectionString = process.env.SUPABASE_DB_URL
    if (!connectionString) {
      throw new Error('Missing SUPABASE_DB_URL — check .env.test')
    }

    const client = new Client({ connectionString })
    await client.connect()

    const result = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    )
    const tableNames = result.rows.map((r) => r.table_name)

    await client.end()

    for (const table of EXPECTED_TABLES) {
      expect(tableNames).toContain(table)
    }
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — nenhuma das tabelas existe ainda.

- [ ] **Step 4: Escrever a migration**

Create `supabase/migrations/20260712000000_initial_schema.sql`:
```sql
create table profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('emagrecimento', 'hipertrofia', 'condicionamento', 'saude_geral')),
  level text not null check (level in ('iniciante', 'intermediario', 'avancado')),
  days_per_week int not null check (days_per_week between 1 and 7),
  equipment text not null,
  restrictions text,
  onboarding_transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exercise (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  instructions text,
  muscle_group text not null,
  equipment text,
  media_url text,
  created_at timestamptz not null default now()
);

create table training_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_month date not null,
  goal text not null,
  periodization_phase text not null check (periodization_phase in ('acumulacao', 'intensificacao', 'deload')),
  created_at timestamptz not null default now(),
  unique (user_id, reference_month)
);

create table workout_day (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references training_plan(id) on delete cascade,
  week_number int not null check (week_number between 1 and 4),
  day_label text not null,
  rest_seconds int not null default 90,
  created_at timestamptz not null default now()
);

create table workout_day_exercise (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_day(id) on delete cascade,
  exercise_id uuid not null references exercise(id),
  order_index int not null,
  target_sets int not null,
  target_reps int not null,
  target_load_kg numeric(6,2)
);

create table workout_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id uuid not null references workout_day(id),
  performed_at timestamptz not null default now(),
  completed boolean not null default false,
  duration_seconds int
);

create table workout_session_set (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_session(id) on delete cascade,
  exercise_id uuid not null references exercise(id),
  set_number int not null,
  reps_done int not null,
  load_kg numeric(6,2)
);

create table monthly_checkin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_month date not null,
  conversation_summary text,
  pain_signal boolean not null default false,
  motivation_level int check (motivation_level between 1 and 5),
  difficulty_level int check (difficulty_level between 1 and 5),
  adjustment_decision text,
  created_at timestamptz not null default now(),
  unique (user_id, reference_month)
);

create table body_metric (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_checkin_id uuid references monthly_checkin(id),
  recorded_at date not null default current_date,
  weight_kg numeric(5,2),
  measurements jsonb
);

-- Row Level Security: este projeto Supabase é compartilhado com o CRM da
-- AM Impulse (mesma anon/service_role key). Toda tabela nova do Bora
-- Treinar! fica isolada por dono via RLS, mesmo compartilhando o projeto.

alter table profile enable row level security;
create policy "profile_owner" on profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table exercise enable row level security;
create policy "exercise_read_authenticated" on exercise
  for select using (auth.role() = 'authenticated');

alter table training_plan enable row level security;
create policy "training_plan_owner" on training_plan
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table workout_day enable row level security;
create policy "workout_day_owner" on workout_day
  for all using (
    exists (
      select 1 from training_plan
      where training_plan.id = workout_day.training_plan_id
      and training_plan.user_id = auth.uid()
    )
  );

alter table workout_day_exercise enable row level security;
create policy "workout_day_exercise_owner" on workout_day_exercise
  for all using (
    exists (
      select 1 from workout_day
      join training_plan on training_plan.id = workout_day.training_plan_id
      where workout_day.id = workout_day_exercise.workout_day_id
      and training_plan.user_id = auth.uid()
    )
  );

alter table workout_session enable row level security;
create policy "workout_session_owner" on workout_session
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table workout_session_set enable row level security;
create policy "workout_session_set_owner" on workout_session_set
  for all using (
    exists (
      select 1 from workout_session
      where workout_session.id = workout_session_set.workout_session_id
      and workout_session.user_id = auth.uid()
    )
  );

alter table monthly_checkin enable row level security;
create policy "monthly_checkin_owner" on monthly_checkin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table body_metric enable row level security;
create policy "body_metric_owner" on body_metric
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 5: Aplicar a migration no projeto remoto**

Run:
```bash
npx supabase db push
```
Expected: aplica `supabase/migrations/20260712000000_initial_schema.sql` ao projeto remoto linkado no Task 3, terminando com `Finished supabase db push`. Se pedir confirmação, confirmar.

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260712000000_initial_schema.sql lib/supabase/schema.test.ts package.json package-lock.json
git commit -m "feat: add initial database schema migration"
```

---

## Task 5: Cliente Supabase tipado (browser + server)

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- Test: `lib/supabase/client.test.ts`

**Interfaces:**
- Consumes: `.env.local` do Task 3, tabela `exercise` do Task 4
- Produces: `createBrowserSupabaseClient()` em `lib/supabase/client.ts` e `createServerSupabaseClient()` em `lib/supabase/server.ts`, ambos retornando um `SupabaseClient` tipado

- [ ] **Step 1: Instalar os pacotes do Supabase**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Escrever o teste do cliente (falhando)**

Create `lib/supabase/client.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { createServerSupabaseClient } from './server'

describe('createServerSupabaseClient', () => {
  it('connects and can query the exercise table', async () => {
    const client = createServerSupabaseClient()
    const { data, error } = await client.from('exercise').select('*').limit(1)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `createServerSupabaseClient` não existe (`lib/supabase/server.ts` não existe ainda).

- [ ] **Step 4: Implementar `lib/supabase/server.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(url, key)
}
```

- [ ] **Step 5: Implementar `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

`.env.test` já é carregado pelo `vitest.config.ts` desde o Task 3 — não é necessário nenhum passo extra de configuração aqui.

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/supabase/client.test.ts package.json package-lock.json
git commit -m "feat: add typed Supabase browser and server clients"
```

---

## Task 6: Autenticação por email/senha

**Files:**
- Create: `app/login/page.tsx`, `lib/supabase/middleware.ts`, `proxy.ts`
- Test: `lib/supabase/middleware.test.ts`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient` e `createServerSupabaseClient` do Task 5
- Produces: rota `/login` funcional; `proxy.ts` protegendo todas as rotas exceto `/login`

> **Nota de implementação (atualizado após a Task 6):** o Next.js 16 renomeou a convenção de `middleware.ts`/função `middleware()` para `proxy.ts`/função `proxy()`, e a API de cookies do `@supabase/ssr` usada aqui trocou os métodos `get`/`set`/`remove` pelos métodos em lote `getAll`/`setAll`. Os passos e trechos de código abaixo já refletem o que foi de fato implementado.

- [ ] **Step 1: Escrever teste da função que decide se a rota precisa de auth (falhando)**

Create `lib/supabase/middleware.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { isPublicPath } from './middleware'

describe('isPublicPath', () => {
  it('treats /login as public', () => {
    expect(isPublicPath('/login')).toBe(true)
  })

  it('treats other paths as protected', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/treino')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
npm test
```
Expected: FAIL — `isPublicPath` não existe.

- [ ] **Step 3: Implementar `lib/supabase/middleware.ts`**

```typescript
const PUBLIC_PATHS = ['/login']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Implementar o `proxy.ts` na raiz do projeto**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from './lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (isPublicPath(request.nextUrl.pathname)) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Implementar a página `/login`**

Create `app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-black">Bora Treinar!</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-black"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-black"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded bg-[#2DD4BF] p-2 font-medium text-black"
        >
          Entrar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Build para garantir que tudo compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add proxy.ts lib/supabase/middleware.ts lib/supabase/middleware.test.ts app/login/page.tsx
git commit -m "feat: add email/password authentication with route protection"
```

---

## Task 7: Tema visual base (fundo claro, texto preto, verde água)

> **Nota de implementação (atualizado após revisão da Task 1):** este projeto usa Tailwind CSS v4, que não tem `tailwind.config.ts` — a configuração de tema é feita inline via o bloco `@theme` dentro de `app/globals.css`. Os passos abaixo foram ajustados para esse modelo.

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`

**Interfaces:**
- Consumes: nenhum
- Produces: token de cor `--color-brand` (`#2DD4BF`) no `@theme inline` de `app/globals.css`, disponível como `bg-brand`, `text-brand`, `border-brand`

- [ ] **Step 1: Fixar a paleta clara e adicionar a cor de marca em `app/globals.css`**

`app/globals.css` atualmente é:
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Substituir pelo conteúdo abaixo — remove o dark mode automático (o design pede fundo claro fixo, não adaptativo ao sistema) e adiciona o token `--color-brand`:
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --brand: #2dd4bf;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 2: Confirmar que a classe utilitária `bg-brand` compila**

Temporariamente, em `app/page.tsx`, adicionar `<div className="bg-brand h-4 w-4" />` no topo do JSX retornado, só para validar a geração da utility class.

Run:
```bash
npm run build
```
Expected: `Compiled successfully` (confirma que `bg-brand` foi reconhecida — se o build falhar reclamando de classe desconhecida, o token `--color-brand` não foi registrado corretamente no `@theme`).

Remover o `<div>` de teste em seguida.

- [ ] **Step 3: Ajustar `app/layout.tsx` para usar as classes base**

Garantir que a tag `<body>` em `app/layout.tsx` tenha `bg-background text-foreground` nas classes (mantendo `min-h-full flex flex-col` já existentes):
```tsx
<body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
```

- [ ] **Step 4: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "style: apply base color theme (light background, black text, aqua-green accent)"
```

---

## Fim da Fase 1

Ao final desta fase: `npm run dev` sobe o app, `/login` autentica contra o Supabase local, rotas protegidas redirecionam sem sessão, o banco tem todas as tabelas do domínio, e o layout já usa a paleta definitiva. Isso é a base para a Fase 2 (biblioteca de exercícios).
