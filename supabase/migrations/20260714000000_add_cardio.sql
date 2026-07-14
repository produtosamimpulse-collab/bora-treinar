alter table exercise
  add column if not exists is_cardio boolean not null default false;

alter table workout_day
  add column if not exists cardio_exercise_id uuid references exercise(id),
  add column if not exists cardio_minutes int,
  add column if not exists cardio_intensity text;
