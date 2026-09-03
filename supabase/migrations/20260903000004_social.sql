-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 4 of 6: friends, direct messages, presence, statuses, the listen
-- queue, list likes, message reports, and notification triggers (§4, §8.1).
--
-- Design note: friendship writes go through SECURITY DEFINER functions instead
-- of insert/update policies. The spec's policy algebra ("addressee may accept,
-- either party may block") is easy to get subtly wrong; a function with explicit
-- checks is easy to read and to test (supabase/test/run.mjs does).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles: status, presence, OAuth, supporter, queue visibility ─────────
alter table public.profiles
  add column if not exists status_text        text,
  add column if not exists status_emoji       text,
  add column if not exists status_updated_at  timestamptz,
  add column if not exists status_expires_at  timestamptz,      -- null = until manually cleared
  add column if not exists now_playing_id     uuid references public.catalog_items(id) on delete set null,
  add column if not exists now_playing_source text,
  add column if not exists now_playing_at     timestamptz,
  add column if not exists listenbrainz_user  text,
  add column if not exists accent_color       text,
  add column if not exists supporter_since    timestamptz,
  add column if not exists supporter_until    timestamptz,
  add column if not exists queue_public       boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_status_len') then
    alter table public.profiles add constraint profiles_status_len check (char_length(status_text) <= 140) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_now_playing_source') then
    alter table public.profiles add constraint profiles_now_playing_source
      check (now_playing_source is null or now_playing_source in ('manual','listenbrainz','lastfm')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_accent_color_hex') then
    alter table public.profiles add constraint profiles_accent_color_hex
      check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 1000) not valid;
  end if;
end $$;
create index if not exists profiles_supporter_until_idx on public.profiles (supporter_until);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- ─── friendships — mutual, explicit, and the gate on DMs ───────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  blocked_by   uuid references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_uniq on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b));
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'blocked'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b));
$$;

-- Send (or, if the other person already asked you, accept) a friend request.
create or replace function public.friend_request(p_user uuid) returns public.friendships
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f public.friendships;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if uid = p_user then raise exception 'you cannot friend yourself' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such user' using errcode = 'P0002';
  end if;

  select * into f from public.friendships
  where least(requester_id, addressee_id) = least(uid, p_user)
    and greatest(requester_id, addressee_id) = greatest(uid, p_user);

  if f.id is null then
    insert into public.friendships (requester_id, addressee_id) values (uid, p_user) returning * into f;
  elsif f.status = 'blocked' then
    raise exception 'request not possible' using errcode = '42501';
  elsif f.status = 'pending' and f.addressee_id = uid then
    update public.friendships set status = 'accepted', responded_at = now() where id = f.id returning * into f;
  end if;
  return f;
end $$;

create or replace function public.friend_respond(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where id = p_id and addressee_id = uid and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee_id = uid and status = 'pending';
  end if;
end $$;

-- Cancel an outgoing request or unfriend. Blocks are untouched here.
create or replace function public.friend_remove(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships
  where status <> 'blocked'
    and least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
$$;

create or replace function public.user_block(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if uid = p_user then raise exception 'cannot block yourself' using errcode = '22023'; end if;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(uid, p_user)
    and greatest(requester_id, addressee_id) = greatest(uid, p_user);
  insert into public.friendships (requester_id, addressee_id, status, blocked_by, responded_at)
  values (uid, p_user, 'blocked', uid, now());
  -- blocking also removes the follow edges in both directions
  delete from public.follows where (follower_id = uid and following_id = p_user) or (follower_id = p_user and following_id = uid);
end $$;

create or replace function public.user_unblock(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships
  where status = 'blocked' and blocked_by = auth.uid()
    and least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
$$;

alter table public.friendships enable row level security;
select public._drop_policies('public.friendships');
create policy "friendships: parties read" on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
-- No insert/update/delete policies: the functions above are the only writers.

-- ─── direct messages ───────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  last_message_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz default now(),
  last_read_at    timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  shared_item_id  uuid references public.catalog_items(id) on delete set null,  -- "sending someone a record"
  created_at      timestamptz default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);

create index if not exists messages_conversation_idx   on public.messages (conversation_id, created_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);
create index if not exists conversations_last_idx      on public.conversations (last_message_at desc);

-- SECURITY DEFINER keeps the policies readable and the recursion out (§4).
create or replace function public.is_conversation_member(p_conv uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members m where m.conversation_id = p_conv and m.user_id = p_user);
$$;

-- Member AND not blocked by / blocking any other member.
create or replace function public.can_message(p_conv uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_conversation_member(p_conv, p_user)
     and not exists (
       select 1 from public.conversation_members m
       where m.conversation_id = p_conv and m.user_id <> p_user
         and public.is_blocked_between(m.user_id, p_user));
$$;

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

select public._drop_policies('public.conversations');
create policy "conversations: members read" on public.conversations for select
  using (public.is_conversation_member(id, auth.uid()));

select public._drop_policies('public.conversation_members');
create policy "conversation_members: members read" on public.conversation_members for select
  using (public.is_conversation_member(conversation_id, auth.uid()));

select public._drop_policies('public.messages');
create policy "messages: members read" on public.messages for select
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "messages: members write" on public.messages for insert
  with check (sender_id = auth.uid() and deleted_at is null and public.can_message(conversation_id, auth.uid()));
create policy "messages: sender edits" on public.messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Only friends may open a conversation — enforced here, not in the UI (§8.1).
create or replace function public.get_or_create_conversation(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); conv uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if uid = p_user then raise exception 'you cannot message yourself' using errcode = '22023'; end if;
  if not public.are_friends(uid, p_user) then
    raise exception 'only friends can message each other' using errcode = '42501';
  end if;

  select m1.conversation_id into conv
  from public.conversation_members m1
  join public.conversation_members m2
    on m2.conversation_id = m1.conversation_id and m2.user_id = p_user
  where m1.user_id = uid
    and (select count(*) from public.conversation_members m3 where m3.conversation_id = m1.conversation_id) = 2
  limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, uid), (conv, p_user);
  end if;
  return conv;
end $$;

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conv and user_id = auth.uid();
  update public.notifications set read = true
  where user_id = auth.uid() and type = 'message' and ref_id = p_conv and read = false;
$$;

-- Inbox: one row per conversation for the signed-in user.
create or replace function public.conversations_overview()
returns table (
  conversation_id uuid, other_id uuid, other_username text, other_avatar text, other_accent text,
  other_supporter_until timestamptz, other_status_text text, other_status_emoji text,
  last_body text, last_at timestamptz, last_sender_id uuid, last_shared_item_id uuid, unread int
) language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.username, o.avatar_url, o.accent_color, o.supporter_until, o.status_text, o.status_emoji,
         lm.body, lm.created_at, lm.sender_id, lm.shared_item_id,
         (select count(*)::int from public.messages x
           where x.conversation_id = c.id and x.sender_id <> me.user_id
             and x.created_at > me.last_read_at and x.deleted_at is null)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members om on om.conversation_id = c.id and om.user_id <> me.user_id
  join public.profiles o on o.id = om.user_id
  left join lateral (
    select body, created_at, sender_id, shared_item_id from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by created_at desc limit 1) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

-- ─── message reports (the report/block path ships with messaging, §8.1) ────
create table if not exists public.message_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  message_id  uuid not null references public.messages(id) on delete cascade,
  reason      text check (char_length(reason) <= 500),
  created_at  timestamptz default now(),
  unique (reporter_id, message_id)
);
alter table public.message_reports enable row level security;
select public._drop_policies('public.message_reports');
create policy "message_reports: insert own" on public.message_reports for insert
  with check (reporter_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id and public.is_conversation_member(m.conversation_id, auth.uid())));
-- No select policy for users: reports are read by the owner in the dashboard.

-- ─── listen queue — "to be listened to" (§8.1) ─────────────────────────────
create table if not exists public.listen_queue (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  note            text check (char_length(note) <= 280),
  added_at        timestamptz default now(),
  primary key (user_id, catalog_item_id)
);
create index if not exists listen_queue_user_idx on public.listen_queue (user_id, added_at desc);

alter table public.listen_queue enable row level security;
select public._drop_policies('public.listen_queue');
-- Private by default; visible to others only if the owner flipped profiles.queue_public.
create policy "listen_queue: owner or public" on public.listen_queue for select
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_id and p.queue_public));
create policy "listen_queue: insert own" on public.listen_queue for insert with check (user_id = auth.uid());
create policy "listen_queue: update own" on public.listen_queue for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "listen_queue: delete own" on public.listen_queue for delete using (user_id = auth.uid());

-- ─── list likes (powers the "likes" sort in §8.3) ──────────────────────────
create table if not exists public.list_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  list_id    uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, list_id)
);
create index if not exists list_likes_list_idx on public.list_likes (list_id);
alter table public.list_likes enable row level security;
select public._drop_policies('public.list_likes');
create policy "list_likes: public read" on public.list_likes for select using (true);
create policy "list_likes: insert own"  on public.list_likes for insert with check (user_id = auth.uid());
create policy "list_likes: delete own"  on public.list_likes for delete using (user_id = auth.uid());

-- ─── notifications: types + triggers ───────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications add constraint notifications_type_check
      check (type in ('follow','review_like','friend_request','friend_accepted','message')) not valid;
  end if;
end $$;

create or replace function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, from_user_id) values (new.following_id, 'follow', new.follower_id);
  return new;
end $$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_on_follow();

create or replace function public.notify_on_review_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.ratings where id = new.rating_id;
  if owner is not null and owner <> new.user_id then   -- skipped when you like your own review (§9)
    insert into public.notifications (user_id, type, from_user_id, ref_id) values (owner, 'review_like', new.user_id, new.rating_id);
  end if;
  return new;
end $$;
drop trigger if exists review_likes_notify on public.review_likes;
create trigger review_likes_notify after insert on public.review_likes for each row execute function public.notify_on_review_like();

create or replace function public.notify_on_friendship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, from_user_id, ref_id) values (new.addressee_id, 'friend_request', new.requester_id, new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, from_user_id, ref_id) values (new.requester_id, 'friend_accepted', new.addressee_id, new.id);
    update public.notifications set read = true where type = 'friend_request' and ref_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update on public.friendships for each row execute function public.notify_on_friendship();

create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- one unread "message" notification per conversation, not one per message
  insert into public.notifications (user_id, type, from_user_id, ref_id)
  select m.user_id, 'message', new.sender_id, new.conversation_id
  from public.conversation_members m
  where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
    and not exists (select 1 from public.notifications n
                    where n.user_id = m.user_id and n.type = 'message' and n.ref_id = new.conversation_id and n.read = false);
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_insert();

-- Unread badges for the nav.
create or replace function public.unread_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notifications', (select count(*) from public.notifications where user_id = auth.uid() and read = false),
    'messages', (select count(*) from public.conversation_members cm
                  where cm.user_id = auth.uid()
                    and exists (select 1 from public.messages m
                                where m.conversation_id = cm.conversation_id and m.sender_id <> cm.user_id
                                  and m.created_at > cm.last_read_at and m.deleted_at is null)));
$$;

-- ─── Realtime: chat subscribes to messages (RLS still applies) ─────────────
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end $$;
