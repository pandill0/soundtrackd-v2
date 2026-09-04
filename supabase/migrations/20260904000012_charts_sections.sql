-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 12: the charts page sections — this week's best, trending with
-- people you follow, the artists you've rated, and the site-wide stat box.
-- ═══════════════════════════════════════════════════════════════════════════

-- Albums rated in the last p_days, ranked by how well they did this week.
create or replace function public.charts_week(p_days int default 7, p_min int default 1, p_limit int default 12)
returns table (id uuid, title text, artist_name text, artist_id uuid, cover_url text, release_year int,
               week_count int, week_avg float, rating_count int, avg_rating float)
language sql stable as $$
  select ci.id, ci.title, ci.artist_name, ci.artist_id, ci.cover_url, ci.release_year,
         w.n, w.avg, coalesce(s.rating_count, 0), s.avg_rating
  from (
    select catalog_item_id, count(*)::int as n, round(avg(rating)::numeric, 2)::float as avg
    from public.ratings
    where catalog_item_id is not null and created_at > now() - make_interval(days => p_days)
    group by catalog_item_id
  ) w
  join public.catalog_items ci on ci.id = w.catalog_item_id
  left join public.album_stats s on s.catalog_item_id = ci.id
  where w.n >= p_min
  order by w.avg desc, w.n desc, ci.title
  limit p_limit;
$$;

-- What the people you follow have been rating lately, with up to three of them shown.
create or replace function public.trending_with_friends(p_days int default 14, p_limit int default 12)
returns table (id uuid, title text, artist_name text, artist_id uuid, cover_url text, release_year int,
               friend_count int, friend_avg float, friends jsonb)
language sql stable as $$
  with mine as (select following_id as id from public.follows where follower_id = auth.uid())
  select ci.id, ci.title, ci.artist_name, ci.artist_id, ci.cover_url, ci.release_year,
         count(*)::int, round(avg(r.rating)::numeric, 2)::float,
         (select jsonb_agg(jsonb_build_object('username', p.username, 'avatar_url', p.avatar_url, 'rating', x.rating))
            from (select r2.user_id, r2.rating from public.ratings r2 join mine m2 on m2.id = r2.user_id
                  where r2.catalog_item_id = ci.id order by r2.created_at desc limit 3) x
            join public.profiles p on p.id = x.user_id)
  from public.ratings r
  join mine on mine.id = r.user_id
  join public.catalog_items ci on ci.id = r.catalog_item_id
  where r.created_at > now() - make_interval(days => p_days)
  group by ci.id, ci.title, ci.artist_name, ci.artist_id, ci.cover_url, ci.release_year
  order by count(*) desc, max(r.created_at) desc
  limit p_limit;
$$;

-- The artists behind the albums you've rated, most-rated first.
create or replace function public.artists_you_rated(p_limit int default 12)
returns table (id uuid, title text, cover_url text, rating_count int, avg_rating float, last_rated timestamptz)
language sql stable as $$
  select a.id, a.title, a.cover_url, count(*)::int, round(avg(r.rating)::numeric, 2)::float, max(r.created_at)
  from public.ratings r
  join public.catalog_items ci on ci.id = r.catalog_item_id
  join public.catalog_items a on a.id = ci.artist_id
  where r.user_id = auth.uid()
  group by a.id, a.title, a.cover_url
  order by count(*) desc, max(r.created_at) desc
  limit p_limit;
$$;

-- Site-wide numbers for the charts stat box.
create or replace function public.site_stats() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'total',    (select count(*) from public.ratings) + (select count(*) from public.track_ratings),
    'albums',   (select count(*) from public.ratings),
    'songs',    (select count(*) from public.track_ratings),
    'today',    (select count(*) from public.ratings where created_at > now() - interval '24 hours')
              + (select count(*) from public.track_ratings where created_at > now() - interval '24 hours'),
    'avg',      (select round(avg(rating)::numeric, 2) from public.ratings),
    'members',  (select count(*) from public.profiles where username_set),
    'distribution', (select jsonb_agg(jsonb_build_object('bucket', d.bucket, 'n', d.n) order by d.bucket) from public.community_distribution() d)
  );
$$;
