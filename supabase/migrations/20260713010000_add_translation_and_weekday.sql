alter table exercise add column name_pt text;
alter table exercise add column muscle_group_pt text;
alter table exercise add column instructions_pt text;
alter table workout_day add column day_of_week smallint check (day_of_week between 1 and 7);
