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
