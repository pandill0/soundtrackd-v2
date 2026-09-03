-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 2 of 6: auth — profile creation trigger, username rules (§5).
-- Replaces v1's localStorage "pendingUsername" dance entirely.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists username_set boolean not null default true;

-- Username format for NEW rows (existing rows are not validated).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username ~ '^[A-Za-z0-9_]{3,20}$') not valid;
  end if;
end $$;

-- Same rules as src/lib/config.ts → keep the two lists in sync.
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_username, '') ~ '^[A-Za-z0-9_]{3,20}$'
     and lower(p_username) <> all (array[
       'admin','administrator','soundtrackd','support','supporters','api','auth','login','logout',
       'signup','welcome','dash','profile','album','artist','song','search','charts','lists','list',
       'members','friends','messages','queue','settings','notifications','me'])
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- Creates the profile row the moment auth.users gets a row.
--  • Password signup passes the username as auth metadata (options.data.username).
--  • Google/OAuth signups have no username: they get a placeholder and username_set = false,
--    and the app forces the choose-your-username step before anything else (§5).
--  • A username that was valid at form time but got taken in the meantime falls back to
--    the placeholder path instead of failing the whole signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested  text := trim(new.raw_user_meta_data->>'username');
  final_name text;
  is_set     boolean := false;
  avatar     text := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
begin
  if requested is not null and public.username_available(requested) then
    final_name := requested;
    is_set := true;
  else
    loop
      final_name := 'listener_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      exit when not exists (select 1 from public.profiles where lower(username) = lower(final_name));
    end loop;
  end if;

  insert into public.profiles (id, username, username_set, avatar_url)
  values (new.id, final_name, is_set, avatar)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time username choice for OAuth signups (the /welcome step).
create or replace function public.set_username(p_username text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.profiles;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into rec from public.profiles where id = uid;
  if rec.id is null then
    raise exception 'profile missing' using errcode = 'P0002';
  end if;
  if rec.username_set then
    raise exception 'username already set' using errcode = '23505';
  end if;
  if not public.username_available(p_username) then
    raise exception 'username unavailable' using errcode = '23505';
  end if;
  update public.profiles set username = p_username, username_set = true
  where id = uid returning * into rec;
  return rec;
end $$;

-- Presence: called (throttled) by the app on page loads.
alter table public.profiles add column if not exists last_seen_at timestamptz;
create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
