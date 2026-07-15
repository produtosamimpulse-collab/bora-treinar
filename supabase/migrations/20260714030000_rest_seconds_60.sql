alter table workout_day alter column rest_seconds set default 60;

update workout_day set rest_seconds = 60 where rest_seconds = 90;
