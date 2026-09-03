import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getItem, getItems } from '$lib/server/catalog';
import { config } from '$lib/config';
import { isUuid } from '$lib/utils';
import type { FavoriteAlbum, FavoriteArtist, Profile } from '$lib/types';

const SORTS = new Set(['date', 'rating', 'year', 'artist', 'title']);
const QSORTS = new Set(['added', 'year', 'artist', 'rating']);

/**
 * NOTE: the viewed member is returned as `member`, never as `profile` — `page.data.profile` is
 * reserved for the signed-in user (set by the root layout) and the nav reads it.
 */
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const sb = locals.supabase;
	const { data: row } = await sb.from('profiles').select('*').ilike('username', params.username).maybeSingle();
	if (!row) error(404, 'No member by that name');
	const member = row as Profile & { queue_public?: boolean };
	const viewer = locals.user?.id ?? null;
	const own = viewer === member.id;

	const tabParam = url.searchParams.get('tab');
	const canSeeQueue = own || !!member.queue_public;
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
	const other = viewer && !own;

	const [stats, ratings, lists, iFollow, theyFollow, block, queue, genres] = await Promise.all([
		sb.rpc('profile_stats', { p_user: member.id }),
		tab === 'reviews'
			? sb.rpc('user_ratings', { p_user: member.id, p_sort: sort, p_dir: dir, p_min: min, p_max: null, p_year: year, p_genre: genre, p_reviewed: reviewed, p_limit: 60, p_offset: 0 })
			: null,
		tab === 'lists' ? sb.rpc('lists_directory', { p_sort: 'updated', p_type: null, p_user: member.id, p_limit: 40, p_offset: 0 }) : null,
		other ? sb.from('follows').select('id').eq('follower_id', viewer).eq('following_id', member.id).maybeSingle() : null,
		other ? sb.from('follows').select('id').eq('follower_id', member.id).eq('following_id', viewer).maybeSingle() : null,
		other
			? sb.from('friendships').select('blocked_by').eq('status', 'blocked').or(`and(requester_id.eq.${viewer},addressee_id.eq.${member.id}),and(requester_id.eq.${member.id},addressee_id.eq.${viewer})`).maybeSingle()
			: null,
		tab === 'queue' ? sb.rpc('queue_list', { p_user: member.id, p_sort: qsort, p_dir: dir, p_genre: genre, p_decade: decade }) : null,
		sb.rpc('rated_genres', { p_limit: 30 })
	]);

	const following = !!iFollow?.data;
	const followsMe = !!theyFollow?.data;
	const blockedByMe = !!block?.data && block.data.blocked_by === viewer;
	const blockedByThem = !!block?.data && !blockedByMe;

	// Favourites: rows with a catalogId link to real pages; v1-era entries still render from their saved cover.
	const favAlbums = ((member.favorite_albums ?? []) as (FavoriteAlbum | null)[]).slice(0, 4);
	const favArtists = ((member.favorite_artists ?? []) as (FavoriteArtist | null)[]).slice(0, 4);
	const favIds = [...favAlbums, ...favArtists].map((f) => f?.catalogId).filter((x): x is string => !!x);
	const favItems = favIds.length ? await getItems(favIds) : [];
	const favMap = Object.fromEntries(favItems.map((i) => [i.id, i]));

	const fresh = member.now_playing_at && Date.now() - new Date(member.now_playing_at).getTime() < config.nowPlayingMaxAgeMinutes * 60_000;
	const nowPlaying = fresh && member.now_playing_id ? await getItem(member.now_playing_id) : null;
	const statusLive = member.status_text && (!member.status_expires_at || new Date(member.status_expires_at) > new Date());

	return {
		member,
		own,
		tab,
		canSeeQueue,
		stats: (stats.data as Record<string, number | null> & { distribution?: { bucket: number; n: number }[] }) ?? {},
		ratings: (ratings?.data as Record<string, unknown>[] | null) ?? [],
		lists: (lists?.data as Record<string, unknown>[] | null) ?? [],
		queue: (queue?.data as Record<string, unknown>[] | null) ?? [],
		following,
		followsMe,
		friend: following && followsMe && !block?.data,
		blockedByMe,
		blockedByThem,
		favAlbums,
		favArtists,
		favMap,
		nowPlaying,
		status: statusLive ? { text: member.status_text, emoji: member.status_emoji } : null,
		genres: ((genres.data as { genre: string; n: number }[] | null) ?? []).map((g) => g.genre)
	};
};

export const actions: Actions = {
	/** Save favourite albums/artists (own profile only). Order in the array is the rank. */
	favorites: async ({ request, locals, params }) => {
		if (!locals.user || !locals.profile) return fail(401, { error: 'Sign in first.' });
		if (locals.profile.username.toLowerCase() !== params.username.toLowerCase()) return fail(403, { error: 'Not your profile.' });
		const form = await request.formData();
		const parse = (key: string): Record<string, unknown>[] => {
			try {
				const arr = JSON.parse(String(form.get(key) ?? '[]'));
				return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object').slice(0, 4) : [];
			} catch {
				return [];
			}
		};
		const albums = parse('favorite_albums').map((a) => ({
			id: String(a.id ?? ''),
			catalogId: isUuid(a.catalogId as string) ? a.catalogId : null,
			name: String(a.name ?? '').slice(0, 200),
			artist: String(a.artist ?? '').slice(0, 200),
			cover: String(a.cover ?? '').slice(0, 500)
		}));
		const artists = parse('favorite_artists').map((a) => ({
			id: String(a.id ?? ''),
			catalogId: isUuid(a.catalogId as string) ? a.catalogId : null,
			name: String(a.name ?? '').slice(0, 200),
			picture: String(a.picture ?? '').slice(0, 500)
		}));
		const { error: err } = await locals.supabase.from('profiles').update({ favorite_albums: albums, favorite_artists: artists }).eq('id', locals.user.id);
		if (err) return fail(400, { error: err.message });
		return { saved: true };
	}
};
