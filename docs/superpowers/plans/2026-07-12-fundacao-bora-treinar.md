# Fundação — Bora Treinar! Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter o esqueleto do app "Bora Treinar!" rodando localmente: projeto Next.js configurado, schema completo do banco no Supabase, autenticação por email/senha funcionando, e o tema visual (fundo claro, texto preto, detalhes verde água) aplicado no layout base.

**Architecture:** Next.js (App Router, TypeScript) hospedado na Vercel, com Supabase como banco Postgres + Auth. Testes com Vitest rodando contra uma instância local do Supabase (via `supabase start`, que usa Docker). Migrations SQL versionadas em `supabase/migrations/`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Supabase CLI, Vitest.

## Global Constraints

- Autenticação: Supabase Auth, login por email/senha (sem OAuth, sem cadastro público — usuário único hoje)
- Banco: Postgres via Supabase, schema versionado em `supabase/migrations/`
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

## Task 3: Inicializar Supabase local

**Files:**
- Create: `supabase/config.toml` (gerado pelo CLI), `.env.local`, `.env.test`
- Modify: `.gitignore` (garantir que `.env.local` e `.env.test` não sejam commitados)

**Interfaces:**
- Consumes: nenhum
- Produces: instância local do Supabase rodando (Postgres + Auth), acessível via URL/keys salvas em `.env.local`

- [ ] **Step 1: Instalar Supabase CLI como dependência de dev**

Run:
```bash
npm install -D supabase
```
Expected: instala sem erro.

- [ ] **Step 2: Inicializar o projeto Supabase**

Run:
```bash
npx supabase init
```
Expected: cria a pasta `supabase/` com `config.toml`.

- [ ] **Step 3: Subir o Supabase local (requer Docker Desktop instalado e aberto)**

Run:
```bash
npx supabase start
```
Expected: baixa as imagens Docker (pode demorar na primeira vez) e imprime uma tabela com `API URL`, `anon key`, `service_role key`.

- [ ] **Step 4: Salvar as credenciais locais**

Criar `.env.local` na raiz com os valores impressos no passo anterior:
```bash
NEXT_PUBLIC_SUPABASE_URL=<API URL do output>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key do output>
```

Criar `.env.test` com os mesmos valores (usado pelos testes de schema no Task 4):
```bash
SUPABASE_URL=<API URL do output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key do output>
```

- [ ] **Step 5: Garantir que os `.env*` locais não vão pro git**

Confirmar que `.gitignore` contém as linhas:
```
.env.local
.env.test
```
(o `create-next-app` já adiciona `.env*.local` por padrão — adicionar `.env.test` manualmente se não estiver coberto.)

- [ ] **Step 6: Confirmar que a instância está no ar**

Run:
```bash
npx supabase status
```
Expected: lista os serviços (`API URL`, `DB URL`, `Studio URL`, etc.) com status ativo.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml .gitignore
git commit -m "chore: initialize local Supabase instance"
```

---

## Task 4: Migration com o schema completo do banco

**Files:**
- Create: `supabase/migrations/20260712000000_initial_schema.sql`
- Test: `lib/supabase/schema.test.ts`

**Interfaces:**
- Consumes: instância Supabase local do Task 3 (`.env.test`)
- Produces: tabelas `profile`, `exercise`, `training_plan`, `workout_day`, `workout_day_exercise`, `workout_session`, `workout_session_set`, `monthly_checkin`, `body_metric` no Postgres

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
    const client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    })
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
```

- [ ] **Step 5: Aplicar a migration**

Run:
```bash
npx supabase db reset
```
Expected: reseta o banco local e aplica todas as migrations em `supabase/migrations/`, terminando com `Finished supabase db reset`.

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260712000000_initial_schema.sql lib/supabase/schema.test.ts package.json
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

- [ ] **Step 6: Carregar `.env.test` no Vitest**

Modify `vitest.config.ts` para ler o `.env.test`:
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

Run:
```bash
npm install -D dotenv
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/supabase/client.test.ts vitest.config.ts package.json
git commit -m "feat: add typed Supabase browser and server clients"
```

---

## Task 6: Autenticação por email/senha

**Files:**
- Create: `app/login/page.tsx`, `lib/supabase/middleware.ts`, `middleware.ts`
- Test: `lib/supabase/middleware.test.ts`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient` e `createServerSupabaseClient` do Task 5
- Produces: rota `/login` funcional; `middleware.ts` protegendo todas as rotas exceto `/login`

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

- [ ] **Step 5: Implementar o `middleware.ts` na raiz do projeto**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  if (isPublicPath(request.nextUrl.pathname)) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set(name, value, options),
        remove: (name, options) => response.cookies.set(name, '', options),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

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
git add middleware.ts lib/supabase/middleware.ts lib/supabase/middleware.test.ts app/login/page.tsx
git commit -m "feat: add email/password authentication with route protection"
```

---

## Task 7: Tema visual base (fundo claro, texto preto, verde água)

**Files:**
- Modify: `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: nenhum
- Produces: token de cor `brand` (`#2DD4BF`) disponível em `tailwind.config.ts` como `bg-brand`, `text-brand`, `border-brand`

- [ ] **Step 1: Adicionar a cor de marca no `tailwind.config.ts`**

Modify `tailwind.config.ts`, dentro de `theme.extend.colors`:
```typescript
colors: {
  brand: '#2DD4BF',
  background: '#FFFFFF',
  foreground: '#0A0A0A',
},
```

- [ ] **Step 2: Aplicar fundo e texto padrão em `app/globals.css`**

No topo de `app/globals.css`, garantir:
```css
body {
  background-color: #FFFFFF;
  color: #0A0A0A;
}
```

- [ ] **Step 3: Ajustar `app/layout.tsx` para usar as classes base**

Garantir que a tag `<body>` em `app/layout.tsx` tenha `className="bg-background text-foreground antialiased"`.

- [ ] **Step 4: Build para confirmar que compila**

Run:
```bash
npm run build
```
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts app/globals.css app/layout.tsx
git commit -m "style: apply base color theme (light background, black text, aqua-green accent)"
```

---

## Fim da Fase 1

Ao final desta fase: `npm run dev` sobe o app, `/login` autentica contra o Supabase local, rotas protegidas redirecionam sem sessão, o banco tem todas as tabelas do domínio, e o layout já usa a paleta definitiva. Isso é a base para a Fase 2 (biblioteca de exercícios).
