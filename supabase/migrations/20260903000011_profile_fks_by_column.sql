-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 11: make sure every user-id column on the v1 tables has a foreign
-- key to public.profiles, detected by COLUMN rather than by name. The v1 tables
-- may carry same-named keys that point at auth.users instead, which migration
-- 10 mistook for ours. The app embeds profiles by column name from now on.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public._ensure_profile_fk(p_table regclass, p_column text) returns void
language plpgsql as $$
declare
  v_attnum int2;
  v_name   text := replace(p_table::text, 'public.', '') || '_' || p_column || '_profiles_fkey';
begin
  select attnum into v_attnum from pg_attribute where attrelid = p_table and attname = p_column and not attisdropped;
  if v_attnum is null then return; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.contype = 'f' and c.conrelid = p_table
      and c.confrelid = 'public.profiles'::regclass
      and c.conkey = array[v_attnum]
  ) then
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete cascade not valid',
                   p_table, v_name, p_column);
  end if;
end $$;

select public._ensure_profile_fk('public.ratings',       'user_id');
select public._ensure_profile_fk('public.track_ratings', 'user_id');
select public._ensure_profile_fk('public.review_likes',  'user_id');
select public._ensure_profile_fk('public.follows',       'follower_id');
select public._ensure_profile_fk('public.follows',       'following_id');
select public._ensure_profile_fk('public.notifications', 'user_id');
select public._ensure_profile_fk('public.notifications', 'from_user_id');
select public._ensure_profile_fk('public.lists',         'user_id');

notify pgrst, 'reload schema';
