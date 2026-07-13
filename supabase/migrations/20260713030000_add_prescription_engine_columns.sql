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
