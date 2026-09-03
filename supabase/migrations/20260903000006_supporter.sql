-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 6 of 6: the single supporter tier (§13.2B) — cosmetic only.
-- Only the payment webhook (service role) grants supporter status.
-- Lapsing is non-destructive: the badge stops rendering, nothing else changes.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  provider                 text not null,
  provider_customer_id     text,
  provider_subscription_id text not null,
  status                   text not null check (status in ('active','lapsed','cancelled')),
  current_period_end       timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  unique (provider, provider_subscription_id)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
select public._drop_policies('public.subscriptions');
create policy "subscriptions: read own" on public.subscriptions for select using (user_id = auth.uid());
-- No write policies: the webhook handler uses the service role.

-- The entitlement rule, in SQL. Mirrors isSupporter() in src/lib/entitlements.ts.
-- Usable as a computed column in PostgREST: profiles?select=*,is_supporter
create or replace function public.is_supporter(p public.profiles) returns boolean
language sql stable as $$
  select p.supporter_until is not null and p.supporter_until > now();
$$;

create or replace view public.supporters_public with (security_invoker = true) as
  select id, username, avatar_url, accent_color, supporter_since
  from public.profiles
  where supporter_until is not null and supporter_until > now()
  order by supporter_since asc nulls last;

-- Applied by the webhook. Idempotent: the same event twice leaves the same state.
create or replace function public.apply_subscription_event(
  p_provider text, p_subscription_id text, p_customer_id text, p_user uuid,
  p_status text, p_period_end timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, provider, provider_customer_id, provider_subscription_id, status, current_period_end)
  values (p_user, p_provider, p_customer_id, p_subscription_id, p_status, p_period_end)
  on conflict (provider, provider_subscription_id) do update
    set status = excluded.status,
        current_period_end = excluded.current_period_end,
        provider_customer_id = coalesce(excluded.provider_customer_id, public.subscriptions.provider_customer_id),
        updated_at = now();

  if p_status = 'active' then
    update public.profiles
    set supporter_since = coalesce(supporter_since, now()),
        supporter_until = greatest(coalesce(supporter_until, p_period_end), p_period_end)
    where id = p_user;
  else
    -- lapsed/cancelled: access runs to the end of the paid period, then stops. Nothing is deleted.
    update public.profiles set supporter_until = least(coalesce(supporter_until, p_period_end), coalesce(p_period_end, now()))
    where id = p_user;
  end if;
end $$;
revoke execute on function public.apply_subscription_event(text, text, text, uuid, text, timestamptz) from public, anon, authenticated;

-- ─── Column protection on profiles ─────────────────────────────────────────
-- "update own row" RLS would otherwise let a user write their own supporter_until, rename
-- themselves, or flip username_set and re-run the welcome step. Only the service role (the
-- webhook / jobs) and set_username() (which sets a session flag) may touch these columns.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_user boolean := auth.uid() is not null;   -- a signed-in user's JWT; service role has none
  allow_username boolean := coalesce(current_setting('soundtrackd.allow_username_change', true), '') = '1';
begin
  if is_user then
    new.supporter_since := old.supporter_since;
    new.supporter_until := old.supporter_until;
    new.id := old.id;
    new.created_at := old.created_at;
    if not allow_username then
      new.username := old.username;
      new.username_set := old.username_set;
    end if;
    -- users can only ever set the manual now-playing source; pollers set the others
    if new.now_playing_source is distinct from old.now_playing_source and new.now_playing_source <> 'manual' then
      new.now_playing_source := 'manual';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- set_username() is the one sanctioned username write: it raises the flag for its own transaction.
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
  perform set_config('soundtrackd.allow_username_change', '1', true);
  update public.profiles set username = p_username, username_set = true
  where id = uid returning * into rec;
  perform set_config('soundtrackd.allow_username_change', '', true);
  return rec;
end $$;
