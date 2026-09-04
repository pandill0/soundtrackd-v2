/**
 * Applies every migration to an in-process Postgres (PGlite) and exercises the
 * trigger, RLS, rating, friendship, messaging, queue and supporter paths.
 *   npm run db:test
 * No Docker, no network. Stubs the two Supabase-provided pieces the SQL relies on
 * (the auth schema and the anon/authenticated/service_role roles).
 */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'migrations');
const db = new PGlite();

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
	if (cond) {
		passed++;
		console.log('  ✓', msg);
	} else {
		failed++;
		console.log('  ✗', msg);
	}
};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await rows(sql, params))[0];
const fails = async (fn, msg, pattern) => {
	try {
		await fn();
		ok(false, `${msg} (expected an error)`);
	} catch (e) {
		ok(!pattern || pattern.test(e.message), `${msg} → "${e.message.split('\n')[0]}"`);
	}
};
/** Run fn as an authenticated user: RLS applies, auth.uid() = userId. */
async function as(userId, fn) {
	await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
	try {
		return await fn();
	} finally {
		await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
	}
}
const anon = async (fn) => {
	await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
	try {
		return await fn();
	} finally {
		await db.exec('reset role;');
	}
};

// ── Supabase stubs ────────────────────────────────────────────────────────
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

// ── Apply migrations in order ─────────────────────────────────────────────
console.log('Applying migrations');
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
	const sql = await readFile(path.join(migrationsDir, f), 'utf8');
	try {
		await db.exec(sql);
		console.log('  ✓', f);
	} catch (e) {
		console.log('  ✗', f, '\n    ', e.message);
		process.exit(1);
	}
}
// Re-applying must be a no-op (the live project will run these on top of v1).
console.log('Re-applying (idempotency)');
for (const f of files) {
	try {
		await db.exec(await readFile(path.join(migrationsDir, f), 'utf8'));
	} catch (e) {
		console.log('  ✗ second run of', f, '\n    ', e.message);
		process.exit(1);
	}
}
console.log('  ✓ all migrations re-applied cleanly');

// ── Tests ─────────────────────────────────────────────────────────────────
console.log('\nAuth trigger + usernames');
const u1 = (await one(`insert into auth.users (email, raw_user_meta_data) values ('a@x.io', '{"username":"august_test"}') returning id`)).id;
const p1 = await one('select * from public.profiles where id = $1', [u1]);
ok(p1?.username === 'august_test' && p1.username_set === true, 'password signup creates profile from metadata');

const u2 = (await one(`insert into auth.users (email, raw_user_meta_data) values ('b@x.io', '{"username":"August_Test","avatar_url":"https://img/x.png"}') returning id`)).id;
const p2 = await one('select * from public.profiles where id = $1', [u2]);
ok(p2?.username.startsWith('listener_') && p2.username_set === false, 'taken username (case-insensitive) falls back to placeholder + username_set=false');
ok(p2?.avatar_url === 'https://img/x.png', 'OAuth avatar carried into the profile');

const u3 = (await one(`insert into auth.users (email) values ('c@x.io') returning id`)).id;
const p3 = await one('select * from public.profiles where id = $1', [u3]);
ok(p3?.username.startsWith('listener_') && p3.username_set === false, 'OAuth signup without metadata gets a placeholder');

ok((await one(`select public.username_available('fresh_name') as a`)).a === true, 'username_available: free name');
ok((await one(`select public.username_available('AUGUST_test') as a`)).a === false, 'username_available: taken (case-insensitive)');
ok((await one(`select public.username_available('admin') as a`)).a === false, 'username_available: reserved');
ok((await one(`select public.username_available('ab') as a`)).a === false, 'username_available: too short');

await as(u2, async () => {
	const r = await one(`select username, username_set from public.set_username('second_user')`);
	ok(r.username === 'second_user' && r.username_set === true, 'set_username completes the OAuth welcome step');
	await fails(() => db.query(`select public.set_username('third_try')`), 'set_username refuses a second change', /already set/);
});
await as(u3, () => db.query(`select public.set_username('third_user')`));

console.log('\nCatalogue');
const artistRow = (await rows(`select * from public.catalog_upsert_items($1::jsonb)`, [JSON.stringify([
	{ kind: 'artist', title: 'Radiohead', cover_url: 'https://img/rh.jpg', provider_ids: { deezer: '399' } }
])]))[0];
ok(!!artistRow?.id && artistRow.kind === 'artist', 'artist upserted');
const albumRow = (await rows(`select * from public.catalog_upsert_items($1::jsonb)`, [JSON.stringify([
	{ kind: 'album', title: 'OK Computer', artist_name: 'Radiohead', artist_id: artistRow.id, release_date: '1997-05-21',
	  genres: ['alternative', 'rock'], cover_url: 'https://img/okc.jpg', provider_ids: { deezer: '14879699' }, record_type: 'album', track_count: 2 }
])]))[0];
ok(albumRow?.release_year === 1997 && albumRow.genres.length === 2, 'album upserted with generated release_year + genres');
const tracks = await rows(`select * from public.catalog_upsert_items($1::jsonb)`, [JSON.stringify([
	{ kind: 'track', title: 'Airbag', artist_name: 'Radiohead', artist_id: artistRow.id, parent_id: albumRow.id, position: 1, duration_ms: 284000, provider_ids: { deezer: '138545' } },
	{ kind: 'track', title: 'Paranoid Android', artist_name: 'Radiohead', artist_id: artistRow.id, parent_id: albumRow.id, position: 2, duration_ms: 383000, provider_ids: { deezer: '138546' } }
])]);
ok(tracks.length === 2 && tracks[0].parent_id === albumRow.id, 'tracks upserted under the album');
const again = (await rows(`select * from public.catalog_upsert_items($1::jsonb)`, [JSON.stringify([
	{ kind: 'album', title: 'OK Computer', provider_ids: { deezer: '14879699' }, label: 'Parlophone' }
])]))[0];
ok(again.id === albumRow.id && again.label === 'Parlophone' && again.cover_url === 'https://img/okc.jpg', 're-upsert by provider id updates in place, keeps existing fields');
const total = (await one(`select count(*)::int as n from public.catalog_items`)).n;
ok(total === 4, `catalogue has 4 rows (got ${total})`);
const mb = '3b5d4c3e-6a1b-4a4e-9c2b-1f1f1f1f1f1f';
await db.query(`select public.catalog_set_mbid($1, $2, null)`, [albumRow.id, mb]);
ok((await one('select mbid from public.catalog_items where id = $1', [albumRow.id])).mbid === mb, 'catalog_set_mbid stamps the MBID');
const byMbid = (await rows(`select * from public.catalog_upsert_items($1::jsonb)`, [JSON.stringify([{ kind: 'album', title: 'OK Computer (2017 remaster)', mbid: mb, provider_ids: { discogs: 'r1' } }])]))[0];
ok(byMbid.id === albumRow.id && byMbid.provider_ids.discogs === 'r1' && byMbid.provider_ids.deezer === '14879699', 'upsert matches on MBID and merges provider_ids');
ok(byMbid.title === 'OK Computer', 'a cross-provider match does not rename the record');
await db.query(`select public.catalog_touch_discography($1)`, [artistRow.id]);
ok(!!(await one('select discography_at from public.catalog_items where id = $1', [artistRow.id])).discography_at, 'catalog_touch_discography stamps the artist');
await as(u1, () => fails(() => db.query(`select public.catalog_upsert_items('[]'::jsonb)`), 'users cannot call catalog_upsert_items', /permission denied/));
await as(u1, () => fails(() => db.query(`insert into public.catalog_items (kind, title) values ('album', 'poison')`), 'users cannot insert catalog rows', /row-level security|permission denied/));

console.log('\nRatings');
await as(u1, async () => {
	const r = await one(`select public.rate_item('album', $1, 4.5, '  a great record  ') as r`, [albumRow.id]);
	ok(r.r.rating === 4.5 && r.r.review === 'a great record', 'rate_item inserts an album rating (review trimmed)');
	const r2 = await one(`select public.rate_item('album', $1, 3.5, null) as r`, [albumRow.id]);
	ok(r2.r.id === r.r.id, 're-rating updates the same row');
	ok((await one(`select count(*)::int as n from public.ratings where user_id = $1`, [u1])).n === 1, 'one row per (user, album)');
	await fails(() => db.query(`select public.rate_item('album', $1, 4.3, null)`, [albumRow.id]), 'rejects a non-half-step rating', /half-step/);
	await fails(() => db.query(`select public.rate_item('track', $1, 4, null)`, [albumRow.id]), 'rejects kind mismatch', /kind mismatch/);
	const t = await one(`select public.rate_item('track', $1, 5, 'best opener') as r`, [tracks[0].id]);
	const tr = await one(`select * from public.track_ratings where id = $1`, [t.r.id]);
	ok(tr.album_item_id === albumRow.id && tr.track_id === '138545' && tr.catalog_item_id === tracks[0].id, 'track rating stamps album_item_id + legacy ids (§11 #4)');
});
// Legacy row (v1 style, Deezer text id only) merges with the v2 rating instead of duplicating.
await db.query(`insert into public.ratings (user_id, album_id, rating, album_title) values ($1, '14879699', 2, 'OK Computer')`, [u2]);
await as(u2, async () => {
	await db.query(`select public.rate_item('album', $1, 4, 'changed my mind')`, [albumRow.id]);
	const n = (await one(`select count(*)::int as n from public.ratings where user_id = $1`, [u2])).n;
	const row = await one(`select rating, catalog_item_id from public.ratings where user_id = $1`, [u2]);
	ok(n === 1 && row.rating === '4.0' && row.catalog_item_id === albumRow.id, 'v1 legacy row is upgraded in place, not duplicated');
});
const stats = await one(`select * from public.album_stats where catalog_item_id = $1`, [albumRow.id]);
ok(stats.rating_count === 2 && Number(stats.avg_rating) === 3.75 && stats.review_count === 1, `album_stats: count=${stats.rating_count} avg=${stats.avg_rating} reviews=${stats.review_count}`);
const dist = await rows(`select * from public.rating_distribution('album', $1)`, [albumRow.id]);
ok(dist.length === 10 && dist.find((d) => Number(d.bucket) === 3.5).n === 1 && dist.find((d) => Number(d.bucket) === 4).n === 1, 'rating_distribution has 10 zero-filled buckets');
await as(u3, async () => {
	await db.query(`select public.unrate_item('album', $1)`, [albumRow.id]);
	ok((await one(`select count(*)::int as n from public.ratings`)).n === 2, 'unrate only touches your own row');
});
await as(u1, async () => {
	const revs = await rows(`select * from public.reviews_for_item('album', $1, 'top', 10, 0)`, [albumRow.id]);
	ok(revs.length === 1 && revs[0].username === 'second_user', 'reviews_for_item returns only rows with review text');
});

console.log('\nFollows, likes, notifications');
await as(u2, async () => {
	await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u2, u1]);
	await fails(() => db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u1, u2]), 'cannot insert a follow as someone else', /row-level security/);
	await fails(() => db.query(`insert into public.notifications (user_id, type, from_user_id) values ($1, 'follow', $2)`, [u1, u2]), 'cannot forge a notification (no insert policy)', /row-level security/);
	ok((await rows(`select * from public.notifications`)).length === 0, "cannot read someone else's notifications");
});
await as(u1, async () => {
	const n = await rows(`select * from public.notifications`);
	ok(n.length === 1 && n[0].type === 'follow' && n[0].from_user_id === u2, 'follow trigger notified the followed user');
	const myReview = await one(`select id from public.ratings where user_id = $1`, [u2]);
	await db.query(`insert into public.review_likes (user_id, rating_id) values ($1, $2)`, [u1, myReview.id]);
	const ownReview = await one(`select id from public.ratings where user_id = $1`, [u1]);
	await db.query(`insert into public.review_likes (user_id, rating_id) values ($1, $2)`, [u1, ownReview.id]);
});
await as(u2, async () => {
	const n = await rows(`select * from public.notifications where type = 'review_like'`);
	ok(n.length === 1 && n[0].from_user_id === u1, 'review_like trigger notified the author');
});
await as(u1, async () => {
	ok((await rows(`select * from public.notifications where type = 'review_like'`)).length === 0, 'liking your own review does not notify you');
});

console.log('\nFriends = mutual follows');
ok((await one(`select public.are_friends($1, $2) as f`, [u1, u2])).f === false, 'one-way follow is not friendship');
await as(u1, async () => {
	await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u1, u2]);
	ok((await one(`select public.are_friends($1, $2) as f`, [u1, u2])).f === true, 'following back makes friends');
	ok(!!(await one(`select 1 from public.notifications where user_id = $1 and type = 'friend_accepted' and from_user_id = $2`, [u1, u2])), 'the follower who completed the pair is told they are now friends');
	await fails(() => db.query(`insert into public.follows (follower_id, following_id) values ($1, $1)`, [u1]), 'cannot follow yourself', /row-level security|follows_not_self/);
	await fails(() => db.query(`select public.friend_request($1)`, [u2]), 'friend_request no longer exists', /does not exist/);
});
await as(u3, async () => {
	ok((await rows(`select * from public.friend_pairs where a = $1`, [u3])).length === 0, 'no pairs for a stranger');
});
ok((await one(`select count(*)::int as n from public.friend_pairs where a = $1`, [u1])).n === 1, 'friend_pairs lists the pair from each side');

console.log('\nMessaging (the RLS that must be right)');
let conv;
await as(u1, async () => {
	conv = (await one(`select public.get_or_create_conversation($1) as c`, [u2])).c;
	const again = (await one(`select public.get_or_create_conversation($1) as c`, [u2])).c;
	ok(conv === again, 'get_or_create_conversation is stable');
	await fails(() => db.query(`select public.get_or_create_conversation($1)`, [u3]), 'cannot open a conversation with a non-friend', /only friends/);
	await db.query(`insert into public.messages (conversation_id, sender_id, body, shared_item_id) values ($1, $2, 'listen to this', $3)`, [conv, u1, albumRow.id]);
	ok((await rows(`select * from public.messages where conversation_id = $1`, [conv])).length === 1, 'member can send + read');
	await fails(() => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'spoof')`, [conv, u2]), 'cannot send as someone else', /row-level security/);
});
await as(u3, async () => {
	ok((await rows(`select * from public.messages`)).length === 0, 'non-member reads nothing');
	ok((await rows(`select * from public.conversations`)).length === 0, 'non-member sees no conversations');
	await fails(() => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'intruder')`, [conv, u3]), 'non-member cannot insert', /row-level security/);
});
await anon(async () => {
	ok((await rows(`select * from public.messages`)).length === 0, 'anonymous reads nothing');
});
await as(u2, async () => {
	const c = (await one(`select public.unread_counts() as c`)).c;
	ok(c.messages === 1 && c.notifications >= 1, `unread_counts → messages=${c.messages} notifications=${c.notifications}`);
	const inbox = await rows(`select * from public.conversations_overview()`);
	ok(inbox.length === 1 && inbox[0].other_username === 'august_test' && inbox[0].unread === 1 && inbox[0].last_shared_item_id === albumRow.id, 'conversations_overview shows the other member, unread count and shared record');
	await db.query(`select public.mark_conversation_read($1)`, [conv]);
	ok((await one(`select public.unread_counts() as c`)).c.messages === 0, 'mark_conversation_read clears the unread count');
	await db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'thanks!')`, [conv, u2]);
	const msgId = (await one(`select id from public.messages where sender_id = $1`, [u1])).id;
	await db.query(`insert into public.message_reports (reporter_id, message_id, reason) values ($1, $2, 'test report')`, [u2, msgId]);
	ok(true, 'member can file a report');
	ok((await rows(`select * from public.message_reports`)).length === 0, 'users cannot read reports (RLS: no select policy → empty)');
	await db.query(`select public.user_block($1)`, [u1]);
	ok((await one(`select public.is_blocked_between($1, $2) as b`, [u1, u2])).b === true, 'user_block records the block');
});
await as(u1, async () => {
	await fails(() => db.query(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hello?')`, [conv, u1]), 'blocked user cannot message', /row-level security/);
	await fails(() => db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u1, u2]), 'blocked user cannot follow', /row-level security/);
	await db.query(`select public.user_unblock($1)`, [u2]);
	ok((await one(`select public.is_blocked_between($1, $2) as b`, [u1, u2])).b === true, 'only the blocker can unblock');
});
await as(u2, async () => {
	await db.query(`select public.user_unblock($1)`, [u1]);
	ok((await one(`select public.is_blocked_between($1, $2) as b`, [u1, u2])).b === false, 'blocker unblocks');
	ok((await one(`select public.are_friends($1, $2) as f`, [u1, u2])).f === false, 'blocking ended the friendship');
	ok((await rows(`select * from public.follows where follower_id = $1`, [u2])).length === 0, 'blocking removed the follow');
	// re-establish the graph for the tests below
	await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u2, u1]);
});
await as(u1, async () => {
	await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [u1, u2]);
	ok((await one(`select public.are_friends($1, $2) as f`, [u1, u2])).f === true, 'following each other again after unblock restores friendship');
});

console.log('\nFeed, charts, directories');
await as(u2, async () => {
	const feed = await rows(`select * from public.activity_feed(20, null)`);
	ok(feed.some((f) => f.kind === 'rating' && f.actor_username === 'august_test'), 'activity_feed shows a followed user\'s rating');
	ok(feed.some((f) => f.kind === 'track_rating'), 'activity_feed includes track ratings');
	ok(feed.some((f) => f.kind === 'friendship'), 'activity_feed includes "became friends" events');
});
await as(u3, async () => {
	ok((await rows(`select * from public.activity_feed(20, null)`)).length === 0, 'empty feed when following nobody');
});
const charts = await rows(`select * from public.charts_albums('rating', null, 1990, null, 1, 10, 0)`);
ok(charts.length === 1 && charts[0].title === 'OK Computer' && charts[0].rating_count === 2, 'charts_albums with decade filter');
ok((await rows(`select * from public.charts_albums('rating', 'jazz', null, null, 1, 10, 0)`)).length === 0, 'charts_albums genre filter excludes');
ok((await rows(`select * from public.charts_tracks('rating', 1, 10, 0)`)).length === 1, 'charts_tracks');
ok((await rows(`select * from public.community_distribution()`)).length === 10, 'community_distribution');
const members = await rows(`select * from public.members_directory(null, 'reviews', 10, 0)`);
ok(members.length === 3 && members[0].review_count === 1, 'members_directory sorted by reviews');
ok((await rows(`select * from public.members_directory('SECOND', 'joined', 10, 0)`)).length === 1, 'members_directory search');
await as(u1, async () => {
	await db.query(`insert into public.lists (user_id, title, type, items) values ($1, 'Desert island', 'albums', '[{"id":"x","type":"album","title":"OK Computer","artist":"Radiohead","cover":"c","albumId":null}]')`, [u1]);
});
await as(u2, async () => {
	const listId = (await one(`select id from public.lists`)).id;
	await db.query(`insert into public.list_likes (user_id, list_id) values ($1, $2)`, [u2, listId]);
	const dir = await rows(`select * from public.lists_directory('likes', null, null, 10, 0)`);
	ok(dir.length === 1 && dir[0].like_count === 1 && dir[0].item_count === 1 && dir[0].liked_by_me === true, 'lists_directory with like count');
});
const ps = (await one(`select public.profile_stats($1) as s`, [u1])).s;
ok(ps.ratings === 1 && ps.followers === 1 && ps.friends === 1 && ps.lists === 1 && ps.distribution.length === 10, `profile_stats → ${JSON.stringify({ ratings: ps.ratings, followers: ps.followers, friends: ps.friends })}`);
const ur = await rows(`select * from public.user_ratings($1, 'rating', 'desc', null, null, 1997, null, null, 10, 0)`, [u1]);
ok(ur.length === 1 && ur[0].title === 'OK Computer' && ur[0].release_year === 1997, 'user_ratings with year filter');
ok((await rows(`select * from public.user_ratings($1, 'date', 'desc', null, null, null, null, true, 10, 0)`, [u1])).length === 0, 'user_ratings reviewed-only filter');
await as(u1, async () => {
	const d = await rows(`select * from public.artist_discography($1, 'year', 'desc', null, null)`, [artistRow.id]);
	ok(d.length === 1 && Number(d[0].my_rating) === 3.5 && d[0].rating_count === 2, 'artist_discography includes my rating + stats');
	const st = await rows(`select * from public.item_stats($1::uuid[])`, [`{${albumRow.id}}`]);
	ok(st.length === 1 && Number(st[0].my_rating) === 3.5, 'item_stats batch');
	const recent = await rows(`select * from public.recent_reviews(5)`);
	ok(recent.length === 1 && recent[0].username === 'second_user', 'recent_reviews');
});

console.log('\nCharts sections');
const wk = await rows(`select * from public.charts_week(7, 1, 10)`);
ok(wk.length === 1 && wk[0].title === 'OK Computer' && wk[0].week_count === 2, 'charts_week ranks this week\'s rated albums');
await as(u2, async () => {
	const tf = await rows(`select * from public.trending_with_friends(14, 10)`);
	ok(tf.length === 1 && tf[0].friend_count === 1 && tf[0].friends.length === 1 && tf[0].friends[0].username === 'august_test', 'trending_with_friends shows what people you follow rated');
});
await as(u3, async () => {
	ok((await rows(`select * from public.trending_with_friends(14, 10)`)).length === 0, 'trending_with_friends is empty when following nobody');
});
await as(u1, async () => {
	const ar = await rows(`select * from public.artists_you_rated(10)`);
	ok(ar.length === 1 && ar[0].title === 'Radiohead' && ar[0].rating_count === 1, 'artists_you_rated groups by artist');
});
const st = (await one(`select public.site_stats() as s`)).s;
ok(st.total === 3 && st.albums === 2 && st.songs === 1 && st.today === 3 && st.members === 3 && st.distribution.length === 10, `site_stats → ${JSON.stringify({ total: st.total, today: st.today, members: st.members })}`);

console.log('\nListen queue + presence');
await as(u1, async () => {
	await db.query(`insert into public.listen_queue (user_id, catalog_item_id, note) values ($1, $2, 'rec from sam')`, [u1, albumRow.id]);
	const q = await rows(`select * from public.queue_list(null, 'added', 'desc', null, null)`);
	ok(q.length === 1 && q[0].note === 'rec from sam' && q[0].rating_count === 2, 'queue_list returns my queue with stats');
	await db.query(`update public.profiles set status_text = 'digging through crates', status_emoji = '📦', now_playing_id = $2, now_playing_source = 'manual', now_playing_at = now() where id = $1`, [u1, albumRow.id]);
	await fails(() => db.query(`update public.profiles set status_text = repeat('x', 141) where id = $1`, [u1]), 'status over 140 chars rejected', /profiles_status_len/);
});
await as(u2, async () => {
	ok((await rows(`select * from public.listen_queue`)).length === 0, 'queue is private by default');
	const np = await rows(`select * from public.friends_now_playing()`);
	ok(np.length === 1 && np[0].np_title === 'OK Computer' && np[0].status_text === 'digging through crates', 'friends_now_playing shows a friend\'s status + record');
});
await db.query(`update public.profiles set queue_public = true where id = $1`, [u1]);
await as(u2, async () => {
	ok((await rows(`select * from public.queue_list($1, 'added', 'desc', null, null)`, [u1])).length === 1, 'public queue is visible to others');
});
await db.query(`update public.profiles set now_playing_at = now() - interval '31 minutes' where id = $1`, [u1]);
await as(u2, async () => {
	ok((await rows(`select * from public.friends_now_playing()`))[0].np_title == null, 'now-playing older than 30 minutes stops rendering');
});

console.log('\nSupporter tier');
ok((await one(`select public.is_supporter(p) as s from public.profiles p where id = $1`, [u1])).s === false, 'not a supporter by default');
await db.query(`select public.apply_subscription_event('lemonsqueezy', 'sub_1', 'cus_1', $1, 'active', now() + interval '365 days')`, [u1]);
ok((await one(`select public.is_supporter(p) as s from public.profiles p where id = $1`, [u1])).s === true, 'webhook event grants supporter');
await db.query(`select public.apply_subscription_event('lemonsqueezy', 'sub_1', 'cus_1', $1, 'active', now() + interval '365 days')`, [u1]);
ok((await one(`select count(*)::int as n from public.subscriptions`)).n === 1, 'replaying the same event is idempotent');
ok((await rows(`select * from public.supporters_public`)).length === 1, 'supporters_public lists them');
await db.query(`select public.apply_subscription_event('lemonsqueezy', 'sub_1', 'cus_1', $1, 'cancelled', now() - interval '1 day')`, [u1]);
ok((await one(`select public.is_supporter(p) as s from public.profiles p where id = $1`, [u1])).s === false, 'lapse removes the badge');
ok((await one(`select count(*)::int as n from public.ratings where user_id = $1`, [u1])).n === 1, 'lapse is non-destructive: ratings intact');
await as(u1, async () => {
	ok((await rows(`select * from public.subscriptions`)).length === 1, 'user reads own subscription');
	await fails(() => db.query(`select public.apply_subscription_event('x','y','z',$1,'active',now())`, [u1]), 'users cannot grant themselves supporter', /permission denied/);
});
await as(u2, async () => {
	ok((await rows(`select * from public.subscriptions`)).length === 0, "cannot read others' subscriptions");
});

console.log('\nProfile column protection');
await as(u1, async () => {
	await db.query(`update public.profiles set supporter_until = now() + interval '10 years', username = 'hacker', username_set = false, bio = 'legit bio change' where id = $1`, [u1]);
	const p = await one(`select username, username_set, bio, public.is_supporter(p) as s from public.profiles p where id = $1`, [u1]);
	ok(p.username === 'august_test' && p.username_set === true && p.s === false && p.bio === 'legit bio change', 'users cannot grant themselves supporter or rename; ordinary fields still save');
	await fails(() => db.query(`select public.set_username('august_renamed')`), 'set_username still refuses once set', /already set/);
	await db.query(`update public.profiles set now_playing_source = 'listenbrainz', now_playing_id = $2, now_playing_at = now() where id = $1`, [u1, albumRow.id]);
	ok((await one(`select now_playing_source from public.profiles where id = $1`, [u1])).now_playing_source === 'manual', 'users can only set the manual now-playing source');
});
const u4 = (await one(`insert into auth.users (email) values ('d@x.io') returning id`)).id;
await as(u4, async () => {
	const r = await one(`select username, username_set from public.set_username('fourth_user')`);
	ok(r.username === 'fourth_user' && r.username_set === true, 'set_username still works for a fresh OAuth signup (flag path)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
