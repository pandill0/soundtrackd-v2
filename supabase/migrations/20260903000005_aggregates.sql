-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 5 of 6: aggregates in Postgres (§11 bug #3) and the parameterised
-- sort/filter functions behind §8.3. Nothing in the browser reduces rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── stats views ───────────────────────────────────────────────────────────
create or replace view public.album_stats with (security_invoker = true) as
  select catalog_item_id,
         count(*)::int                                            as rating_count,
         round(avg(rating)::numeric, 2)::float                     as avg_rating,
         count(*) filter (where nullif(review, '') is not null)::int as review_count
  from public.ratings
  where catalog_item_id is not null
  group by catalog_item_id;

create or replace view public.track_stats with (security_invoker = true) as
  select catalog_item_id,
         count(*)::int                                            as rating_count,
         round(avg(rating)::numeric, 2)::float                     as avg_rating,
         count(*) filter (where nullif(review, '') is not null)::int as review_count
  from public.track_ratings
  where catalog_item_id is not null
  group by catalog_item_id;

-- Ten half-star buckets, zero-filled, for the distribution bar chart.
create or replace function public.rating_distribution(p_kind text, p_item uuid)
returns table (bucket numeric, n int) language sql stable as $$
  with buckets as (select unnest(array[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5]::numeric[]) as bucket),
  counts as (
    select rating, count(*) as n from public.ratings where p_kind = 'album' and catalog_item_id = p_item group by rating
    union all
    select rating, count(*) as n from public.track_ratings where p_kind = 'track' and catalog_item_id = p_item group by rating)
  select b.bucket, coalesce(c.n, 0)::int from buckets b left join counts c on c.rating = b.bucket order by b.bucket;
$$;

-- Site-wide score distribution (charts page stats block).
create or replace function public.community_distribution()
returns table (bucket numeric, n int) language sql stable as $$
  with buckets as (select unnest(array[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5]::numeric[]) as bucket)
  select b.bucket, coalesce((select count(*) from public.ratings r where r.rating = b.bucket), 0)::int
  from buckets b order by b.bucket;
$$;

-- ─── reviews & friends on an item ──────────────────────────────────────────
create or replace function public.reviews_for_item(p_kind text, p_item uuid, p_sort text default 'recent', p_limit int default 20, p_offset int default 0)
returns table (
  id uuid, user_id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz,
  rating numeric, review text, created_at timestamptz, like_count int, liked_by_me boolean
) language sql stable as $$
  select * from (
    select r.id, r.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until,
           r.rating, r.review, r.created_at,
           (select count(*)::int from public.review_likes l where l.rating_id = r.id) as like_count,
           exists (select 1 from public.review_likes l where l.rating_id = r.id and l.user_id = auth.uid()) as liked_by_me
    from public.ratings r join public.profiles p on p.id = r.user_id
    where p_kind = 'album' and r.catalog_item_id = p_item and nullif(r.review, '') is not null
    union all
    select t.id, t.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until,
           t.rating, t.review, t.created_at, 0, false
    from public.track_ratings t join public.profiles p on p.id = t.user_id
    where p_kind = 'track' and t.catalog_item_id = p_item and nullif(t.review, '') is not null
  ) x
  order by case when p_sort = 'top' then x.like_count end desc nulls last, x.created_at desc
  limit p_limit offset p_offset;
$$;

-- What people you follow rated this (the friends panel on album pages).
create or replace function public.followed_ratings_for_item(p_kind text, p_item uuid, p_limit int default 12)
returns table (user_id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz, rating numeric, has_review boolean, created_at timestamptz)
language sql stable as $$
  select p.id, p.username, p.avatar_url, p.accent_color, p.supporter_until, x.rating, x.has_review, x.created_at
  from (
    select user_id, rating, nullif(review,'') is not null as has_review, created_at from public.ratings where p_kind = 'album' and catalog_item_id = p_item
    union all
    select user_id, rating, nullif(review,'') is not null, created_at from public.track_ratings where p_kind = 'track' and catalog_item_id = p_item
  ) x
  join public.follows f on f.following_id = x.user_id and f.follower_id = auth.uid()
  join public.profiles p on p.id = x.user_id
  order by x.created_at desc limit p_limit;
$$;

-- ─── profile ───────────────────────────────────────────────────────────────
create or replace function public.profile_stats(p_user uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'ratings',       (select count(*) from public.ratings where user_id = p_user),
    'reviews',       (select count(*) from public.ratings where user_id = p_user and nullif(review,'') is not null),
    'track_ratings', (select count(*) from public.track_ratings where user_id = p_user),
    'lists',         (select count(*) from public.lists where user_id = p_user),
    'followers',     (select count(*) from public.follows where following_id = p_user),
    'following',     (select count(*) from public.follows where follower_id = p_user),
    'friends',       (select count(*) from public.friendships where status = 'accepted' and p_user in (requester_id, addressee_id)),
    'avg_rating',    (select round(avg(rating)::numeric, 2) from public.ratings where user_id = p_user),
    'this_month',    (select count(*) from public.ratings where user_id = p_user and created_at >= date_trunc('month', now())),
    'distribution',  (select jsonb_agg(jsonb_build_object('bucket', b.bucket, 'n', coalesce(c.n, 0)) order by b.bucket)
                      from (select unnest(array[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5]::numeric[]) as bucket) b
                      left join (select rating, count(*) as n from public.ratings where user_id = p_user group by rating) c on c.rating = b.bucket)
  );
$$;

-- Review history with §8.3 sorting/filtering, joined to the catalogue.
create or replace function public.user_ratings(
  p_user uuid, p_sort text default 'date', p_dir text default 'desc',
  p_min numeric default null, p_max numeric default null, p_year int default null,
  p_genre text default null, p_reviewed boolean default null,
  p_limit int default 40, p_offset int default 0
) returns table (
  id uuid, catalog_item_id uuid, legacy_album_id text, title text, artist_name text, artist_id uuid, cover_url text,
  release_year int, genres text[], rating numeric, review text, created_at timestamptz, like_count int
) language sql stable as $$
  select r.id, r.catalog_item_id, r.album_id,
         coalesce(ci.title, r.album_title) as title, ci.artist_name, ci.artist_id,
         coalesce(ci.cover_url, r.album_cover) as cover_url, ci.release_year, coalesce(ci.genres, '{}'),
         r.rating, r.review, r.created_at,
         (select count(*)::int from public.review_likes l where l.rating_id = r.id)
  from public.ratings r
  left join public.catalog_items ci on ci.id = r.catalog_item_id
  where r.user_id = p_user
    and (p_min is null or r.rating >= p_min)
    and (p_max is null or r.rating <= p_max)
    and (p_year is null or ci.release_year = p_year)
    and (p_genre is null or p_genre = any(ci.genres))
    and (p_reviewed is null or (nullif(r.review,'') is not null) = p_reviewed)
  order by
    case when p_dir = 'asc'  then case p_sort when 'rating' then r.rating when 'year' then ci.release_year::numeric end end asc  nulls last,
    case when p_dir = 'desc' then case p_sort when 'rating' then r.rating when 'year' then ci.release_year::numeric end end desc nulls last,
    case when p_dir = 'asc'  then case p_sort when 'artist' then lower(coalesce(ci.artist_name,'')) when 'title' then lower(coalesce(ci.title, r.album_title, '')) end end asc,
    case when p_dir = 'desc' then case p_sort when 'artist' then lower(coalesce(ci.artist_name,'')) when 'title' then lower(coalesce(ci.title, r.album_title, '')) end end desc,
    case when p_dir = 'asc' and p_sort = 'date' then r.created_at end asc,
    r.created_at desc
  limit p_limit offset p_offset;
$$;

-- ─── the feed (§8.2 module 1) ──────────────────────────────────────────────
create or replace function public.activity_feed(p_limit int default 30, p_before timestamptz default null)
returns table (kind text, id uuid, actor_id uuid, actor_username text, actor_avatar text, actor_accent text,
               actor_supporter_until timestamptz, created_at timestamptz, payload jsonb)
language sql stable as $$
  with who as (select following_id as id from public.follows where follower_id = auth.uid())
  select * from (
    select 'rating'::text, r.id, r.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until, r.created_at,
           jsonb_build_object('item_id', r.catalog_item_id, 'legacy_album_id', r.album_id,
             'title', coalesce(ci.title, r.album_title), 'artist', ci.artist_name,
             'cover', coalesce(ci.cover_url, r.album_cover), 'rating', r.rating, 'review', r.review,
             'like_count', (select count(*) from public.review_likes l where l.rating_id = r.id),
             'liked_by_me', exists (select 1 from public.review_likes l where l.rating_id = r.id and l.user_id = auth.uid()))
    from public.ratings r join who on who.id = r.user_id join public.profiles p on p.id = r.user_id
    left join public.catalog_items ci on ci.id = r.catalog_item_id
    union all
    select 'track_rating', t.id, t.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until, t.created_at,
           jsonb_build_object('item_id', t.catalog_item_id, 'album_item_id', t.album_item_id,
             'title', coalesce(ci.title, t.track_title), 'artist', ci.artist_name,
             'cover', coalesce(ci.cover_url, t.track_cover), 'rating', t.rating, 'review', t.review)
    from public.track_ratings t join who on who.id = t.user_id join public.profiles p on p.id = t.user_id
    left join public.catalog_items ci on ci.id = t.catalog_item_id
    union all
    select 'list', l.id, l.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until, l.created_at,
           jsonb_build_object('title', l.title, 'type', l.type, 'item_count', jsonb_array_length(coalesce(l.items, '[]'::jsonb)),
             'covers', (select jsonb_agg(i->>'cover') from (select i from jsonb_array_elements(coalesce(l.items,'[]'::jsonb)) i limit 4) s))
    from public.lists l join who on who.id = l.user_id join public.profiles p on p.id = l.user_id
    union all
    select 'friendship', f.id, f.requester_id, p.username, p.avatar_url, p.accent_color, p.supporter_until, f.responded_at,
           jsonb_build_object('other_id', o.id, 'other_username', o.username, 'other_avatar', o.avatar_url)
    from public.friendships f
    join who on who.id in (f.requester_id, f.addressee_id)
    join public.profiles p on p.id = f.requester_id
    join public.profiles o on o.id = f.addressee_id
    where f.status = 'accepted' and f.responded_at is not null
  ) x
  where p_before is null or x.created_at < p_before
  order by x.created_at desc
  limit p_limit;
$$;

-- ─── charts (§8 charts, §8.3) ──────────────────────────────────────────────
create or replace function public.charts_albums(
  p_sort text default 'rating', p_genre text default null, p_decade int default null, p_year int default null,
  p_min int default 1, p_limit int default 50, p_offset int default 0
) returns table (
  id uuid, title text, artist_name text, artist_id uuid, cover_url text, release_year int, genres text[],
  rating_count int, avg_rating float, review_count int, recent_count int
) language sql stable as $$
  select ci.id, ci.title, ci.artist_name, ci.artist_id, ci.cover_url, ci.release_year, ci.genres,
         s.rating_count, s.avg_rating, s.review_count,
         (select count(*)::int from public.ratings r where r.catalog_item_id = ci.id and r.created_at > now() - interval '7 days') as recent_count
  from public.album_stats s
  join public.catalog_items ci on ci.id = s.catalog_item_id
  where ci.kind = 'album' and s.rating_count >= p_min
    and (p_genre is null or p_genre = any(ci.genres))
    and (p_decade is null or ci.release_year between p_decade and p_decade + 9)
    and (p_year is null or ci.release_year = p_year)
  order by
    case p_sort when 'rating' then s.avg_rating end desc nulls last,
    case p_sort when 'reviews' then s.review_count end desc,
    case p_sort when 'count' then s.rating_count end desc,
    case p_sort when 'trending' then (select count(*) from public.ratings r where r.catalog_item_id = ci.id and r.created_at > now() - interval '7 days') end desc,
    s.rating_count desc, ci.title
  limit p_limit offset p_offset;
$$;

create or replace function public.charts_tracks(p_sort text default 'rating', p_min int default 1, p_limit int default 50, p_offset int default 0)
returns table (id uuid, title text, artist_name text, artist_id uuid, parent_id uuid, cover_url text, release_year int, rating_count int, avg_rating float)
language sql stable as $$
  select ci.id, ci.title, ci.artist_name, ci.artist_id, ci.parent_id, ci.cover_url, ci.release_year, s.rating_count, s.avg_rating
  from public.track_stats s join public.catalog_items ci on ci.id = s.catalog_item_id
  where ci.kind = 'track' and s.rating_count >= p_min
  order by case p_sort when 'rating' then s.avg_rating end desc nulls last,
           case p_sort when 'count' then s.rating_count end desc,
           s.rating_count desc, ci.title
  limit p_limit offset p_offset;
$$;

-- Distinct genres that actually have rated albums (filter dropdowns).
create or replace function public.rated_genres(p_limit int default 40)
returns table (genre text, n int) language sql stable as $$
  select g, count(*)::int from public.catalog_items ci, unnest(ci.genres) g
  where ci.kind = 'album' and exists (select 1 from public.ratings r where r.catalog_item_id = ci.id)
  group by g order by 2 desc, 1 limit p_limit;
$$;

-- ─── members directory ─────────────────────────────────────────────────────
create or replace function public.members_directory(p_q text default null, p_sort text default 'joined', p_limit int default 60, p_offset int default 0)
returns table (id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz, created_at timestamptz,
               review_count int, status_text text, status_emoji text, last_seen_at timestamptz)
language sql stable as $$
  select p.id, p.username, p.avatar_url, p.accent_color, p.supporter_until, p.created_at,
         (select count(*)::int from public.ratings r where r.user_id = p.id) as review_count,
         case when p.status_expires_at is null or p.status_expires_at > now() then p.status_text end,
         case when p.status_expires_at is null or p.status_expires_at > now() then p.status_emoji end,
         p.last_seen_at
  from public.profiles p
  where p.username_set and (p_q is null or p.username ilike '%' || p_q || '%')
  order by case p_sort when 'reviews' then (select count(*) from public.ratings r where r.user_id = p.id) end desc,
           case p_sort when 'username' then lower(p.username) end asc,
           case p_sort when 'active' then p.last_seen_at end desc nulls last,
           p.created_at desc
  limit p_limit offset p_offset;
$$;

-- ─── lists directory ───────────────────────────────────────────────────────
create or replace function public.lists_directory(p_sort text default 'updated', p_type text default null, p_user uuid default null, p_limit int default 40, p_offset int default 0)
returns table (id uuid, user_id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz,
               title text, description text, type text, items jsonb, item_count int, like_count int, liked_by_me boolean,
               created_at timestamptz, updated_at timestamptz)
language sql stable as $$
  select l.id, l.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until,
         l.title, l.description, l.type, coalesce(l.items, '[]'::jsonb),
         jsonb_array_length(coalesce(l.items, '[]'::jsonb)),
         (select count(*)::int from public.list_likes k where k.list_id = l.id),
         exists (select 1 from public.list_likes k where k.list_id = l.id and k.user_id = auth.uid()),
         l.created_at, l.updated_at
  from public.lists l join public.profiles p on p.id = l.user_id
  where (p_type is null or l.type = p_type) and (p_user is null or l.user_id = p_user)
  order by case p_sort when 'likes' then (select count(*) from public.list_likes k where k.list_id = l.id) end desc,
           case p_sort when 'items' then jsonb_array_length(coalesce(l.items, '[]'::jsonb)) end desc,
           case p_sort when 'created' then l.created_at end desc,
           l.updated_at desc
  limit p_limit offset p_offset;
$$;

-- ─── listen queue (§8.1, §8.3) ─────────────────────────────────────────────
create or replace function public.queue_list(p_user uuid default null, p_sort text default 'added', p_dir text default 'desc', p_genre text default null, p_decade int default null)
returns table (catalog_item_id uuid, note text, added_at timestamptz, title text, artist_name text, artist_id uuid,
               cover_url text, release_year int, genres text[], rating_count int, avg_rating float)
language sql stable as $$
  select q.catalog_item_id, q.note, q.added_at, ci.title, ci.artist_name, ci.artist_id, ci.cover_url, ci.release_year, ci.genres,
         coalesce(s.rating_count, 0), s.avg_rating
  from public.listen_queue q
  join public.catalog_items ci on ci.id = q.catalog_item_id
  left join public.album_stats s on s.catalog_item_id = ci.id
  where q.user_id = coalesce(p_user, auth.uid())
    and (p_genre is null or p_genre = any(ci.genres))
    and (p_decade is null or ci.release_year between p_decade and p_decade + 9)
  order by
    case when p_dir = 'asc'  then case p_sort when 'year' then ci.release_year::numeric when 'rating' then s.avg_rating::numeric end end asc  nulls last,
    case when p_dir = 'desc' then case p_sort when 'year' then ci.release_year::numeric when 'rating' then s.avg_rating::numeric end end desc nulls last,
    case when p_dir = 'asc'  then case p_sort when 'artist' then lower(coalesce(ci.artist_name,'')) end end asc,
    case when p_dir = 'desc' then case p_sort when 'artist' then lower(coalesce(ci.artist_name,'')) end end desc,
    case when p_dir = 'asc' and p_sort = 'added' then q.added_at end asc,
    q.added_at desc;
$$;

-- ─── artist discography with community + your rating ───────────────────────
create or replace function public.artist_discography(p_artist uuid, p_sort text default 'year', p_dir text default 'desc', p_type text default null, p_decade int default null)
returns table (id uuid, title text, cover_url text, release_year int, release_date date, record_type text, genres text[],
               rating_count int, avg_rating float, my_rating numeric)
language sql stable as $$
  select ci.id, ci.title, ci.cover_url, ci.release_year, ci.release_date, ci.record_type, ci.genres,
         coalesce(s.rating_count, 0), s.avg_rating,
         (select r.rating from public.ratings r where r.catalog_item_id = ci.id and r.user_id = auth.uid())
  from public.catalog_items ci
  left join public.album_stats s on s.catalog_item_id = ci.id
  where ci.kind = 'album' and ci.artist_id = p_artist
    and (p_type is null or ci.record_type = p_type)
    and (p_decade is null or ci.release_year between p_decade and p_decade + 9)
  order by
    case when p_dir = 'asc'  then case p_sort when 'year' then ci.release_date::text when 'rating' then s.avg_rating::text when 'mine' then (select r.rating::text from public.ratings r where r.catalog_item_id = ci.id and r.user_id = auth.uid()) when 'title' then lower(ci.title) end end asc  nulls last,
    case when p_dir = 'desc' then case p_sort when 'year' then ci.release_date::text when 'rating' then lpad(s.avg_rating::text, 5, '0') when 'mine' then (select r.rating::text from public.ratings r where r.catalog_item_id = ci.id and r.user_id = auth.uid()) when 'title' then lower(ci.title) end end desc nulls last,
    ci.release_date desc nulls last, ci.title;
$$;

-- ─── dashboard modules (§8.2) ──────────────────────────────────────────────
create or replace function public.friends_now_playing()
returns table (id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz,
               status_text text, status_emoji text, last_seen_at timestamptz,
               now_playing_id uuid, now_playing_at timestamptz, now_playing_source text,
               np_title text, np_artist text, np_cover text)
language sql stable as $$
  select p.id, p.username, p.avatar_url, p.accent_color, p.supporter_until,
         case when p.status_expires_at is null or p.status_expires_at > now() then p.status_text end,
         case when p.status_expires_at is null or p.status_expires_at > now() then p.status_emoji end,
         p.last_seen_at,
         case when p.now_playing_at > now() - interval '30 minutes' then p.now_playing_id end,
         case when p.now_playing_at > now() - interval '30 minutes' then p.now_playing_at end,
         case when p.now_playing_at > now() - interval '30 minutes' then p.now_playing_source end,
         ci.title, ci.artist_name, ci.cover_url
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join public.catalog_items ci on ci.id = p.now_playing_id and p.now_playing_at > now() - interval '30 minutes'
  where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  order by (p.now_playing_at > now() - interval '30 minutes') desc nulls last, p.last_seen_at desc nulls last;
$$;

-- New releases from artists you've rated 4+ (§8.2 module 5): a join, not a recommender.
create or replace function public.new_releases_for_user(p_days int default 120, p_limit int default 12)
returns table (id uuid, title text, artist_name text, artist_id uuid, cover_url text, release_date date, record_type text)
language sql stable as $$
  with liked_artists as (
    select distinct ci.artist_id from public.ratings r
    join public.catalog_items ci on ci.id = r.catalog_item_id
    where r.user_id = auth.uid() and r.rating >= 4 and ci.artist_id is not null)
  select a.id, a.title, a.artist_name, a.artist_id, a.cover_url, a.release_date, a.record_type
  from public.catalog_items a
  join liked_artists la on la.artist_id = a.artist_id
  where a.kind = 'album' and a.release_date >= current_date - p_days
    and not exists (select 1 from public.ratings r where r.catalog_item_id = a.id and r.user_id = auth.uid())
  order by a.release_date desc limit p_limit;
$$;

-- Social proof for the landing page and the dashboard community module.
create or replace function public.recent_reviews(p_limit int default 8)
returns table (id uuid, user_id uuid, username text, avatar_url text, accent_color text, supporter_until timestamptz,
               item_id uuid, legacy_album_id text, title text, artist_name text, cover_url text,
               rating numeric, review text, created_at timestamptz, like_count int)
language sql stable as $$
  select r.id, r.user_id, p.username, p.avatar_url, p.accent_color, p.supporter_until,
         r.catalog_item_id, r.album_id, coalesce(ci.title, r.album_title), ci.artist_name, coalesce(ci.cover_url, r.album_cover),
         r.rating, r.review, r.created_at,
         (select count(*)::int from public.review_likes l where l.rating_id = r.id)
  from public.ratings r join public.profiles p on p.id = r.user_id
  left join public.catalog_items ci on ci.id = r.catalog_item_id
  where nullif(r.review, '') is not null
  order by r.created_at desc limit p_limit;
$$;

-- Ratings on many items at once for grids (community + yours).
create or replace function public.item_stats(p_ids uuid[])
returns table (catalog_item_id uuid, rating_count int, avg_rating float, my_rating numeric)
language sql stable as $$
  select ci.id, coalesce(s.rating_count, 0), s.avg_rating,
         (select r.rating from public.ratings r where r.catalog_item_id = ci.id and r.user_id = auth.uid())
  from public.catalog_items ci
  left join public.album_stats s on s.catalog_item_id = ci.id
  where ci.id = any(p_ids);
$$;

create or replace function public.track_item_stats(p_ids uuid[])
returns table (catalog_item_id uuid, rating_count int, avg_rating float, my_rating numeric)
language sql stable as $$
  select ci.id, coalesce(s.rating_count, 0), s.avg_rating,
         (select t.rating from public.track_ratings t where t.catalog_item_id = ci.id and t.user_id = auth.uid())
  from public.catalog_items ci
  left join public.track_stats s on s.catalog_item_id = ci.id
  where ci.id = any(p_ids);
$$;
