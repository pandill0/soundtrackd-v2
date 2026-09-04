-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 10: foreign keys the v1 tables never had. The dashboard-made tables
-- store user ids as plain uuids, so PostgREST cannot join a row to its author
-- (notifications, follows, lists, ratings all embed profiles by these names).
-- NOT VALID: existing rows are not re-checked, new rows are enforced.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public._ensure_fk(p_name text, p_table regclass, p_column text, p_ref regclass, p_ref_column text default 'id') returns void
language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = p_name and conrelid = p_table) then
    execute format('alter table %s add constraint %I foreign key (%I) references %s(%I) on delete cascade not valid',
                   p_table, p_name, p_column, p_ref, p_ref_column);
  end if;
end $$;

select public._ensure_fk('ratings_user_id_fkey',            'public.ratings',       'user_id',      'public.profiles');
select public._ensure_fk('track_ratings_user_id_fkey',      'public.track_ratings', 'user_id',      'public.profiles');
select public._ensure_fk('review_likes_user_id_fkey',       'public.review_likes',  'user_id',      'public.profiles');
select public._ensure_fk('review_likes_rating_id_fkey',     'public.review_likes',  'rating_id',    'public.ratings');
select public._ensure_fk('follows_follower_id_fkey',        'public.follows',       'follower_id',  'public.profiles');
select public._ensure_fk('follows_following_id_fkey',       'public.follows',       'following_id', 'public.profiles');
select public._ensure_fk('notifications_user_id_fkey',      'public.notifications', 'user_id',      'public.profiles');
select public._ensure_fk('notifications_from_user_id_fkey', 'public.notifications', 'from_user_id', 'public.profiles');
select public._ensure_fk('lists_user_id_fkey',              'public.lists',         'user_id',      'public.profiles');

-- Tell PostgREST to pick up the new relationships right away.
notify pgrst, 'reload schema';
