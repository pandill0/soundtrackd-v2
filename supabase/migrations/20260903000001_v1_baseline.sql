-- ═══════════════════════════════════════════════════════════════════════════
-- Soundtrackd v2 — migration 1 of 6: the v1 baseline, reconciled.
--
-- Written to be IDEMPOTENT: on the live project (where these tables already
-- exist) it only adds what is missing; on a fresh project it creates everything.
-- Apply in the Supabase SQL editor or with `supabase db push` (see SETUP.md).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null,
  bio              text,
  pronouns         text,
  website          text,
  avatar_url       text,
  favorite_albums  jsonb default '[]'::jsonb,
  favorite_artists jsonb default '[]'::jsonb,
  created_at       timestamptz default now()
);
alter table public.profiles add column if not exists favorite_albums  jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists favorite_artists jsonb default '[]'::jsonb;
-- Usernames are unique case-insensitively (live data has mixed case, e.g. "Pickledude448").
create unique index if not exists profiles_username_lower_uniq on public.profiles (lower(username));

-- ─── ratings (albums) ──────────────────────────────────────────────────────
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  album_id    text,                                 -- legacy Deezer id; catalog_item_id (migration 3) is the real key
  rating      numeric(3,1) not null,
  review      text,
  album_title text,
  album_cover text,
  created_at  timestamptz default now(),
  unique (album_id, user_id)
);
alter table public.ratings add column if not exists updated_at timestamptz default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ratings_rating_range') then
    -- NOT VALID: enforced for new rows, existing rows are left alone.
    alter table public.ratings add constraint ratings_rating_range
      check (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2)) not valid;
  end if;
end $$;

-- ─── track_ratings (songs) ─────────────────────────────────────────────────
create table if not exists public.track_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  track_id    text,                                 -- legacy Deezer id
  album_id    text,                                 -- legacy; never populated by v1 (§11 bug #4)
  rating      numeric(3,1) not null,
  review      text,
  track_title text,
  track_cover text,
  created_at  timestamptz default now(),
  unique (track_id, user_id)
);
alter table public.track_ratings add column if not exists album_id   text;
alter table public.track_ratings add column if not exists updated_at timestamptz default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'track_ratings_rating_range') then
    alter table public.track_ratings add constraint track_ratings_rating_range
      check (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2)) not valid;
  end if;
end $$;

-- ─── review_likes ──────────────────────────────────────────────────────────
create table if not exists public.review_likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating_id  uuid not null references public.ratings(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, rating_id)
);

-- ─── follows ───────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now()
);
create unique index if not exists follows_pair_uniq on public.follows (follower_id, following_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'follows_not_self') then
    alter table public.follows add constraint follows_not_self check (follower_id <> following_id) not valid;
  end if;
end $$;

-- ─── notifications ─────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null,
  from_user_id uuid references public.profiles(id) on delete cascade,
  read         boolean default false,
  created_at   timestamptz default now()
);
alter table public.notifications add column if not exists ref_id uuid;   -- rating / friendship / conversation id

-- ─── lists ─────────────────────────────────────────────────────────────────
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  type        text not null,
  items       jsonb default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lists_type_check') then
    alter table public.lists add constraint lists_type_check check (type in ('albums','songs','mixed')) not valid;
  end if;
end $$;

-- ─── indexes v1 never had (§4) ─────────────────────────────────────────────
create index if not exists ratings_album_idx         on public.ratings (album_id);
create index if not exists ratings_user_created_idx  on public.ratings (user_id, created_at desc);
create index if not exists ratings_created_idx       on public.ratings (created_at desc);
create index if not exists track_ratings_track_idx   on public.track_ratings (track_id);
create index if not exists track_ratings_user_idx    on public.track_ratings (user_id, created_at desc);
create index if not exists follows_following_idx     on public.follows (following_id);
create index if not exists follows_follower_idx      on public.follows (follower_id);
create index if not exists notifications_user_idx    on public.notifications (user_id, read, created_at desc);
create index if not exists review_likes_rating_idx   on public.review_likes (rating_id);
create index if not exists lists_user_idx            on public.lists (user_id);
create index if not exists lists_updated_idx         on public.lists (updated_at desc);

-- ─── updated_at maintenance ────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at before update on public.lists
  for each row execute function public.set_updated_at();
drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();
drop trigger if exists track_ratings_set_updated_at on public.track_ratings;
create trigger track_ratings_set_updated_at before update on public.track_ratings
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
-- v1's policies lived only in the dashboard (§4). This replaces them with the
-- canonical set so the schema is reproducible. Policies are OR-ed, so leftover
-- permissive ones would silently widen access — hence the drop-all first.
create or replace function public._drop_policies(p_table regclass) returns void language plpgsql as $$
declare pol record;
begin
  for pol in select polname from pg_policy where polrelid = p_table loop
    execute format('drop policy if exists %I on %s', pol.polname, p_table);
  end loop;
end $$;

alter table public.profiles      enable row level security;
alter table public.ratings       enable row level security;
alter table public.track_ratings enable row level security;
alter table public.review_likes  enable row level security;
alter table public.follows       enable row level security;
alter table public.notifications enable row level security;
alter table public.lists         enable row level security;

select public._drop_policies('public.profiles');
create policy "profiles: public read"   on public.profiles for select using (true);
create policy "profiles: insert own"    on public.profiles for insert with check (id = auth.uid());
create policy "profiles: update own"    on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

select public._drop_policies('public.ratings');
create policy "ratings: public read"    on public.ratings for select using (true);
create policy "ratings: insert own"     on public.ratings for insert with check (user_id = auth.uid());
create policy "ratings: update own"     on public.ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ratings: delete own"     on public.ratings for delete using (user_id = auth.uid());

select public._drop_policies('public.track_ratings');
create policy "track_ratings: public read" on public.track_ratings for select using (true);
create policy "track_ratings: insert own"  on public.track_ratings for insert with check (user_id = auth.uid());
create policy "track_ratings: update own"  on public.track_ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "track_ratings: delete own"  on public.track_ratings for delete using (user_id = auth.uid());

select public._drop_policies('public.review_likes');
create policy "review_likes: public read" on public.review_likes for select using (true);
create policy "review_likes: insert own"  on public.review_likes for insert with check (user_id = auth.uid());
create policy "review_likes: delete own"  on public.review_likes for delete using (user_id = auth.uid());

select public._drop_policies('public.follows');
create policy "follows: public read"    on public.follows for select using (true);
create policy "follows: insert own"     on public.follows for insert with check (follower_id = auth.uid());
create policy "follows: delete own"     on public.follows for delete using (follower_id = auth.uid());

-- Notifications: you read and update only your own. There is deliberately NO
-- insert policy — rows are written by triggers (migration 4), so user A can
-- never forge a notification addressed to user B. This closes the "tricky one" in §4.
select public._drop_policies('public.notifications');
create policy "notifications: read own"   on public.notifications for select using (user_id = auth.uid());
create policy "notifications: update own" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: delete own" on public.notifications for delete using (user_id = auth.uid());

select public._drop_policies('public.lists');
create policy "lists: public read"      on public.lists for select using (true);
create policy "lists: insert own"       on public.lists for insert with check (user_id = auth.uid());
create policy "lists: update own"       on public.lists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lists: delete own"       on public.lists for delete using (user_id = auth.uid());
