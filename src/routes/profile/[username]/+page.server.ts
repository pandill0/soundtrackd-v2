import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getItem, getItems } from '$lib/server/catalog';
import { config } from '$lib/config';
import type { FavoriteAlbum, FavoriteArtist, Friendship, Profile } from '$lib/types';

const SORTS = new Set(['date', 'rating', 'year', 'artist', 'title']);
const QSORTS = new Set(['added', 'year', 'artist', 'rating']);

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const sb = locals.supabase;
	const { data: profile } = await sb.from('profiles').select('*').ilike('username', params.username).maybeSingle();
	if (!profile) error(404, 'No member by that name');
	const p = profile as Profile;
	const viewer = locals.user?.id ?? null;
	const own = viewer === p.id;

	const tabParam = url.searchParams.get('tab');
	const canSeeQueue = own || !!(p as Profile & { queue_public?: boolean }).queue_public;
	const tab = tabParam === 'lists' ? 'lists' : tabParam === 'queue' && canSeeQueue ? 'queue' : 'reviews';

	const sp = url.searchParams;
	const sort = SORTS.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'date';
	const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
	const min = Number(sp.get('min')) || null;
	const year = Number(sp.get('year')) || null;
	const genre = sp.get('genre') || null;
	const reviewed = sp.get('reviewed') === 'yes' ? true : sp.get('reviewed') === 'no' ? false : null;
	const qsort = QSORTS.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'added';
	const decade = Number(sp.get('decade')) || null;

	const [stats, ratings, lists, follow, friendship, queue, genres] = await Promise.all([
		sb.rpc('profile_stats', { p_user: p.id }),
		tab === 'reviews'
			? sb.rpc('user_ratings', { p_user: p.id, p_sort: sort, p_dir: dir, p_min: min, p_max: null, p_year: year, p_genre: genre, p_reviewed: reviewed, p_limit: 60, p_offset: 0 })
			: null,
		tab === 'lists' ? sb.rpc('lists_directory', { p_sort: 'updated', p_type: null, p_user: p.id, p_limit: 40, p_offset: 0 }) : null,
		viewer && !own ? sb.from('follows').select('id').eq('follower_id', viewer).eq('following_id', p.id).maybeSingle() : null,
		viewer && !own
			? sb.from('friendships').select('*').or(`and(requester_id.eq.${viewer},addressee_id.eq.${p.id}),and(requester_id.eq.${p.id},addressee_id.eq.${viewer})`).maybeSingle()
			: null,
		tab === 'queue' ? sb.rpc('queue_list', { p_user: p.id, p_sort: qsort, p_dir: dir, p_genre: genre, p_decade: decade }) : null,
		sb.rpc('rated_genres', { p_limit: 30 })
	]);

	// Favourites: resolve catalogue rows for links/covers where a catalogId exists (v2 data);
	// old Spotify-id favourites (§11 #1) still render from their saved cover + name.
	const favAlbums = ((p.favorite_albums ?? []) as (FavoriteAlbum | null)[]).slice(0, 4);
	const favArtists = ((p.favorite_artists ?? []) as (FavoriteArtist | null)[]).slice(0, 4);
	const favIds = [...favAlbums, ...favArtists].map((f) => f?.catalogId).filter((x): x is string => !!x);
	const favItems = favIds.length ? await getItems(favIds) : [];
	const favMap = Object.fromEntries(favItems.map((i) => [i.id, i]));

	const fresh = p.now_playing_at && Date.now() - new Date(p.now_playing_at).getTime() < config.nowPlayingMaxAgeMinutes * 60_000;
	const nowPlaying = fresh && p.now_playing_id ? await getItem(p.now_playing_id) : null;
	const statusLive = p.status_text && (!p.status_expires_at || new Date(p.status_expires_at) > new Date());

	return {
		profile: p,
		own,
		tab,
		canSeeQueue,
		stats: (stats.data as Record<string, number | null> & { distribution?: { bucket: number; n: number }[] }) ?? {},
		ratings: (ratings?.data as Record<string, unknown>[] | null) ?? [],
		lists: (lists?.data as Record<string, unknown>[] | null) ?? [],
		queue: (queue?.data as Record<string, unknown>[] | null) ?? [],
		following: !!follow?.data,
		friendship: (friendship?.data as Friendship | null) ?? null,
		favAlbums,
		favArtists,
		favMap,
		nowPlaying,
		status: statusLive ? { text: p.status_text, emoji: p.status_emoji } : null,
		genres: ((genres.data as { genre: string; n: number }[] | null) ?? []).map((g) => g.genre)
	};
};
