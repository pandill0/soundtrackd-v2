-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 3 of 6: the local canonical catalogue (§4, §6.1).
-- MBIDs are identity. Provider ids (Deezer today) are cached mappings.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.catalog_items (
  id           uuid primary key default gen_random_uuid(),
  mbid         uuid unique,                          -- MusicBrainz id. NULL only until matched.
  kind         text not null check (kind in ('album','artist','track')),
  title        text not null,
  artist_name  text,
  artist_id    uuid references public.catalog_items(id),  -- album/track → artist
  parent_id    uuid references public.catalog_items(id),  -- track → album
  release_date date,
  release_year int generated always as (extract(year from release_date)::int) stored,
  genres       text[] not null default '{}',
  cover_url    text,
  provider_ids jsonb not null default '{}'::jsonb,   -- {"deezer":"12345"} — read ONLY by the catalogue module
  record_type  text,                                 -- album | ep | single | compilation
  duration_ms  int,
  position     int,                                  -- track number within the album
  label        text,
  track_count  int,
  fetched_at   timestamptz default now(),
  created_at   timestamptz default now(),
  mbid_checked_at timestamptz                        -- last MusicBrainz lookup attempt (backfill job)
);
alter table public.catalog_items add column if not exists mbid_checked_at timestamptz;

create index if not exists catalog_items_provider_ids_idx on public.catalog_items using gin (provider_ids jsonb_path_ops);
create index if not exists catalog_items_genres_idx       on public.catalog_items using gin (genres);
create index if not exists catalog_items_kind_year_idx    on public.catalog_items (kind, release_year desc);
create index if not exists catalog_items_artist_idx       on public.catalog_items (artist_id);
create index if not exists catalog_items_parent_idx       on public.catalog_items (parent_id, position);
create index if not exists catalog_items_unmatched_idx    on public.catalog_items (kind, mbid_checked_at nulls first, created_at) where mbid is null;
-- One row per (provider id, kind). Deezer album/track/artist ids are separate namespaces.
create unique index if not exists catalog_items_deezer_uniq
  on public.catalog_items (kind, (provider_ids->>'deezer')) where provider_ids ? 'deezer';

alter table public.catalog_items enable row level security;
select public._drop_policies('public.catalog_items');
create policy "catalog: public read" on public.catalog_items for select using (true);
-- No write policies on purpose: only the service role (the server-side catalogue module) writes.

-- ─── Link ratings to the catalogue ─────────────────────────────────────────
alter table public.ratings       add column if not exists catalog_item_id uuid references public.catalog_items(id);
alter table public.track_ratings add column if not exists catalog_item_id uuid references public.catalog_items(id);
alter table public.track_ratings add column if not exists album_item_id   uuid references public.catalog_items(id); -- parent album (fixes §11 #4)
alter table public.ratings       alter column album_id drop not null;
alter table public.track_ratings alter column track_id drop not null;

create unique index if not exists ratings_user_item_uniq       on public.ratings (user_id, catalog_item_id) where catalog_item_id is not null;
create unique index if not exists track_ratings_user_item_uniq on public.track_ratings (user_id, catalog_item_id) where catalog_item_id is not null;
create index if not exists ratings_item_idx        on public.ratings (catalog_item_id);
create index if not exists track_ratings_item_idx  on public.track_ratings (catalog_item_id);
create index if not exists track_ratings_album_idx on public.track_ratings (album_item_id);

-- ─── Service-role batch upsert ─────────────────────────────────────────────
-- Input: jsonb array of {kind, title, artist_name, artist_id, parent_id, release_date, genres,
-- cover_url, provider_ids, record_type, duration_ms, position, label, track_count, mbid}.
-- Matches on mbid first, then on (kind, deezer id). Returns the resulting rows in input order.
create or replace function public.catalog_upsert_items(p_items jsonb) returns setof public.catalog_items
language plpgsql security definer set search_path = public as $$
declare
  it       jsonb;
  existing public.catalog_items;
  out_row  public.catalog_items;
  v_mbid   uuid;
  v_deezer text;
  same_provider boolean;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_mbid   := nullif(it->>'mbid', '')::uuid;
    v_deezer := it->'provider_ids'->>'deezer';

    select * into existing from public.catalog_items c
    where (v_mbid is not null and c.mbid = v_mbid)
       or (v_deezer is not null and c.kind = it->>'kind' and c.provider_ids->>'deezer' = v_deezer)
    order by (c.mbid = v_mbid) desc nulls last
    limit 1;

    if existing.id is not null then
      -- A refresh from the SAME provider is authoritative for display fields; a match across
      -- providers (by MBID) only fills blanks and merges provider ids, so a Discogs or
      -- MusicBrainz variant never renames the record everyone already rated.
      same_provider := v_deezer is not null and existing.provider_ids->>'deezer' = v_deezer;
      update public.catalog_items c set
        mbid         = coalesce(c.mbid, v_mbid),
        title        = case when same_provider then coalesce(nullif(it->>'title', ''), c.title) else c.title end,
        artist_name  = case when same_provider then coalesce(nullif(it->>'artist_name', ''), c.artist_name) else coalesce(c.artist_name, nullif(it->>'artist_name', '')) end,
        artist_id    = coalesce(c.artist_id, nullif(it->>'artist_id', '')::uuid),
        parent_id    = coalesce(c.parent_id, nullif(it->>'parent_id', '')::uuid),
        release_date = case when same_provider then coalesce(nullif(it->>'release_date', '')::date, c.release_date) else coalesce(c.release_date, nullif(it->>'release_date', '')::date) end,
        genres       = case when jsonb_typeof(it->'genres') = 'array' and jsonb_array_length(it->'genres') > 0 and (same_provider or cardinality(c.genres) = 0)
                            then array(select jsonb_array_elements_text(it->'genres')) else c.genres end,
        cover_url    = case when same_provider then coalesce(nullif(it->>'cover_url', ''), c.cover_url) else coalesce(c.cover_url, nullif(it->>'cover_url', '')) end,
        provider_ids = c.provider_ids || coalesce(it->'provider_ids', '{}'::jsonb),
        record_type  = coalesce(nullif(it->>'record_type', ''), c.record_type),
        duration_ms  = coalesce((it->>'duration_ms')::int, c.duration_ms),
        position     = coalesce((it->>'position')::int, c.position),
        label        = coalesce(nullif(it->>'label', ''), c.label),
        track_count  = coalesce((it->>'track_count')::int, c.track_count),
        fetched_at   = now()
      where c.id = existing.id
      returning * into out_row;
    else
      insert into public.catalog_items
        (mbid, kind, title, artist_name, artist_id, parent_id, release_date, genres, cover_url,
         provider_ids, record_type, duration_ms, position, label, track_count)
      values (
        v_mbid, it->>'kind', coalesce(nullif(it->>'title',''), 'Untitled'), nullif(it->>'artist_name',''),
        nullif(it->>'artist_id','')::uuid, nullif(it->>'parent_id','')::uuid,
        nullif(it->>'release_date','')::date,
        case when jsonb_typeof(it->'genres') = 'array' then array(select jsonb_array_elements_text(it->'genres')) else '{}' end,
        nullif(it->>'cover_url',''), coalesce(it->'provider_ids', '{}'::jsonb), nullif(it->>'record_type',''),
        (it->>'duration_ms')::int, (it->>'position')::int, nullif(it->>'label',''), (it->>'track_count')::int)
      returning * into out_row;
    end if;
    return next out_row;
  end loop;
end $$;
revoke execute on function public.catalog_upsert_items(jsonb) from public, anon, authenticated;

-- Records a MusicBrainz lookup (the backfill job, §7). p_mbid null = "looked, no confident match",
-- which stamps mbid_checked_at so the row is not retried every run. Service role only.
create or replace function public.catalog_set_mbid(p_id uuid, p_mbid uuid, p_cover text default null) returns void
language sql security definer set search_path = public as $$
  update public.catalog_items
  set mbid = coalesce(mbid, p_mbid), cover_url = coalesce(p_cover, cover_url), mbid_checked_at = now()
  where id = p_id;
$$;
revoke execute on function public.catalog_set_mbid(uuid, uuid, text) from public, anon, authenticated;

-- ─── Rating writes: one function, both kinds (§9) ──────────────────────────
-- Upsert keyed on (user, catalog item). Also fills the legacy Deezer id columns so a row
-- rated in v1 and re-rated in v2 stays ONE row, and stamps album_item_id on track ratings.
create or replace function public.rate_item(p_kind text, p_item uuid, p_rating numeric, p_review text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  item    public.catalog_items;
  legacy  text;
  rid     uuid;
  body    text := nullif(trim(coalesce(p_review, '')), '');
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_rating is null or p_rating < 0.5 or p_rating > 5 or p_rating * 2 <> floor(p_rating * 2) then
    raise exception 'rating must be a half-step between 0.5 and 5' using errcode = '22023';
  end if;
  select * into item from public.catalog_items where id = p_item;
  if item.id is null then raise exception 'unknown catalogue item' using errcode = 'P0002'; end if;
  legacy := item.provider_ids->>'deezer';

  if p_kind = 'album' and item.kind = 'album' then
    select id into rid from public.ratings
    where user_id = uid and (catalog_item_id = p_item or (legacy is not null and album_id = legacy))
    limit 1;
    if rid is null then
      insert into public.ratings (user_id, album_id, catalog_item_id, rating, review, album_title, album_cover)
      values (uid, legacy, p_item, p_rating, body, item.title, item.cover_url)
      returning id into rid;
    else
      update public.ratings set rating = p_rating, review = body, catalog_item_id = p_item,
        album_id = coalesce(album_id, legacy), album_title = coalesce(album_title, item.title),
        album_cover = coalesce(album_cover, item.cover_url)
      where id = rid;
    end if;
  elsif p_kind = 'track' and item.kind = 'track' then
    select id into rid from public.track_ratings
    where user_id = uid and (catalog_item_id = p_item or (legacy is not null and track_id = legacy))
    limit 1;
    if rid is null then
      insert into public.track_ratings (user_id, track_id, catalog_item_id, album_item_id, rating, review, track_title, track_cover)
      values (uid, legacy, p_item, item.parent_id, p_rating, body, item.title, item.cover_url)
      returning id into rid;
    else
      update public.track_ratings set rating = p_rating, review = body, catalog_item_id = p_item,
        album_item_id = coalesce(album_item_id, item.parent_id), track_id = coalesce(track_id, legacy),
        track_title = coalesce(track_title, item.title), track_cover = coalesce(track_cover, item.cover_url)
      where id = rid;
    end if;
  else
    raise exception 'kind mismatch' using errcode = '22023';
  end if;

  return jsonb_build_object('id', rid, 'rating', p_rating, 'review', body);
end $$;

create or replace function public.unrate_item(p_kind text, p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); legacy text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select provider_ids->>'deezer' into legacy from public.catalog_items where id = p_item;
  if p_kind = 'album' then
    delete from public.ratings where user_id = uid and (catalog_item_id = p_item or (legacy is not null and album_id = legacy));
  else
    delete from public.track_ratings where user_id = uid and (catalog_item_id = p_item or (legacy is not null and track_id = legacy));
  end if;
end $$;
