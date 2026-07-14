delete from profile
where id not in (
  select distinct on (user_id) id
  from profile
  order by user_id, created_at desc, id desc
);

alter table profile add constraint profile_user_id_key unique (user_id);
