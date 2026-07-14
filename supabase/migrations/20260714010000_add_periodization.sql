alter table training_plan
  add column if not exists month_number int not null default 1;

alter table workout_day
  add column if not exists week_type text check (week_type in ('calibracao', 'deload', 'progressao'));

alter table workout_session_set
  add column if not exists rir_logged int;
