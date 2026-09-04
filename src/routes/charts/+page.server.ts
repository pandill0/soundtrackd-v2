import type { PageServerLoad } from './$types';
import { heroCovers, newReleasesFromBigArtists, trendingAlbums } from '$lib/server/catalog';

const SORTS = new Set(['rating', 'reviews', 'count', 'trending']);

export const load: PageServerLoad = async ({ url, locals }) => {
	const sp = url.searchParams;
	const tab = sp.get('tab') === 'tracks' ? 'tracks' : sp.get('tab') === 'trending' ? 'trending' : 'albums';
	const sort = SORTS.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'rating';
	const genre = sp.get('genre') || null;
	const decade = Number(sp.get('decade')) || null;
	const year = Number(sp.get('year')) || null;
	const sb = locals.supabase;
	const signedIn = !!locals.user;

	const [stats, week, friends, artists, albums, tracks, genres, decadesRows, covers] = await Promise.all([
		sb.rpc('site_stats'),
		sb.rpc('charts_week', { p_days: 7, p_min: 1, p_limit: 12 }),
		signedIn ? sb.rpc('trending_with_friends', { p_days: 14, p_limit: 12 }) : null,
		signedIn ? sb.rpc('artists_you_rated', { p_limit: 12 }) : null,
		tab === 'albums' ? sb.rpc('charts_albums', { p_sort: sort, p_genre: genre, p_decade: decade, p_year: year, p_min: 1, p_limit: 50, p_offset: 0 }) : null,
		tab === 'tracks' ? sb.rpc('charts_tracks', { p_sort: sort === 'count' ? 'count' : 'rating', p_min: 1, p_limit: 50, p_offset: 0 }) : null,
		sb.rpc('rated_genres', { p_limit: 30 }),
		sb.from('catalog_items').select('release_year').eq('kind', 'album').not('release_year', 'is', null).order('release_year', { ascending: false }).limit(2000),
		heroCovers(10)
	]);

	type Stats = { total: number; albums: number; songs: number; today: number; avg: number | null; members: number; distribution: { bucket: number; n: number }[] | null };
	const s = (stats.data as Stats | null) ?? { total: 0, albums: 0, songs: 0, today: 0, avg: null, members: 0, distribution: null };
	const decades = [...new Set(((decadesRows.data as { release_year: number }[] | null) ?? []).map((r) => Math.floor(r.release_year / 10) * 10))].sort((a, b) => b - a);

	return {
		signedIn,
		tab,
		sort,
		stats: { ...s, distribution: (s.distribution ?? []).map((d) => ({ bucket: Number(d.bucket), n: d.n })) },
		week: (week.data as Record<string, unknown>[] | null) ?? [],
		friends: (friends?.data as Record<string, unknown>[] | null) ?? [],
		artists: (artists?.data as Record<string, unknown>[] | null) ?? [],
		albums: (albums?.data as Record<string, unknown>[] | null) ?? [],
		tracks: (tracks?.data as Record<string, unknown>[] | null) ?? [],
		genres: ((genres.data as { genre: string; n: number }[] | null) ?? []).map((g) => g.genre),
		decades,
		covers,
		// Streamed: these talk to Last.fm/Deezer on a cold cache and must not hold the page.
		releases: newReleasesFromBigArtists(12).catch(() => []),
		trending: tab === 'trending' ? trendingAlbums(20).catch(() => []) : Promise.resolve([])
	};
};
