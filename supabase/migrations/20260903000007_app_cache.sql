-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 7: a small server-side cache (§9 "cache at the edge/server so the
-- benefit is shared across all users"). Holds things like the Last.fm trending
-- list so a cold serverless instance doesn't recompute them. Service role only.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.app_cache (
  key        text primary key,
  value      jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);
alter table public.app_cache enable row level security;
select public._drop_policies('public.app_cache');
-- no policies: only the service role reads or writes this table
