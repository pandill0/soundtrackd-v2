-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 8: friends are mutual follows (the Letterboxd model).
-- A one-way follow puts someone's activity in your feed. When both follow each
-- other they are friends, which is what unlocks messaging. The request/accept
-- flow from migration 4 is removed; blocks stay explicit in `friendships`.
-- ═══════════════════════════════════════════════════════════════════════════

-- Every mutual pair, once per direction (a → b and b → a).
create or replace view public.friend_pairs with (security_invoker = true) as
  select f1.follower_id as a, f1.following_id as b, greatest(f1.created_at, f2.created_at) as since
  from public.follows f1
  join public.follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows x where x.follower_id = a and x.following_id = b)
     and exists (select 1 from public.follows y where y.follower_id = b and y.following_id = a)
     and not public.is_blocked_between(a, b);
$$;

-- You cannot follow someone while a block exists between you, in either direction.
drop policy if exists "follows: insert own" on public.follows;
create policy "follows: insert own" on public.follows for insert
  with check (follower_id = auth.uid() and follower_id <> following_id
              and not public.is_blocked_between(follower_id, following_id));

-- The request/accept flow is gone; pending/accepted rows are meaningless now.
drop function if exists public.friend_request(uuid);
drop function if exists public.friend_respond(uuid, boolean);
drop function if exists public.friend_remove(uuid);
drop trigger if exists friendships_notify on public.friendships;
drop function if exists public.notify_on_friendship();
delete from public.friendships where status <> 'blocked';

-- Follow notification, plus "you're now friends" for the person whose follow completed the pair.
create or replace function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, from_user_id) values (new.following_id, 'follow', new.follower_id);
  if exists (select 1 from public.follows r where r.follower_id = new.following_id and r.following_id = new.follower_id) then
    insert into public.notifications (user_id, type, from_user_id) values (new.follower_id, 'friend_accepted', new.following_id);
  end if;
  return new;
end $$;

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
  from public.friend_pairs fp
  join public.profiles p on p.id = fp.b
  left join public.catalog_items ci on ci.id = p.now_playing_id and p.now_playing_at > now() - interval '30 minutes'
  where fp.a = auth.uid() and not public.is_blocked_between(fp.a, fp.b)
  order by (p.now_playing_at > now() - interval '30 minutes') desc nulls last, p.last_seen_at desc nulls last;
$$;

create or replace function public.profile_stats(p_user uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'ratings',       (select count(*) from public.ratings where user_id = p_user),
    'reviews',       (select count(*) from public.ratings where user_id = p_user and nullif(review,'') is not null),
    'track_ratings', (select count(*) from public.track_ratings where user_id = p_user),
    'lists',         (select count(*) from public.lists where user_id = p_user),
    'followers',     (select count(*) from public.follows where following_id = p_user),
    'following',     (select count(*) from public.follows where follower_id = p_user),
    'friends',       (select count(*) from public.friend_pairs where a = p_user),
    'avg_rating',    (select round(avg(rating)::numeric, 2) from public.ratings where user_id = p_user),
    'this_month',    (select count(*) from public.ratings where user_id = p_user and created_at >= date_trunc('month', now())),
    'distribution',  (select jsonb_agg(jsonb_build_object('bucket', b.bucket, 'n', coalesce(c.n, 0)) order by b.bucket)
                      from (select unnest(array[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5]::numeric[]) as bucket) b
                      left join (select rating, count(*) as n from public.ratings where user_id = p_user group by rating) c on c.rating = b.bucket)
  );
$$;

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
    -- "became friends": the follow that completed a mutual pair, from either side you follow
    select 'friendship', f.id, f.follower_id, p.username, p.avatar_url, p.accent_color, p.supporter_until, f.created_at,
           jsonb_build_object('other_id', o.id, 'other_username', o.username, 'other_avatar', o.avatar_url)
    from public.follows f
    join public.follows r on r.follower_id = f.following_id and r.following_id = f.follower_id and r.created_at <= f.created_at
    join who on who.id in (f.follower_id, f.following_id)
    join public.profiles p on p.id = f.follower_id
    join public.profiles o on o.id = f.following_id
  ) x
  where p_before is null or x.created_at < p_before
  order by x.created_at desc
  limit p_limit;
$$;
