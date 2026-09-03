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
