import type { PageServerLoad } from './$types';
import { trendingAlbums } from '$lib/server/catalog';

const SORTS = new Set(['rating', 'reviews', 'count', 'trending']);

export const load: PageServerLoad = async ({ url, locals }) => {
	const sp = url.searchParams;
	const tab = sp.get('tab') === 'tracks' ? 'tracks' : sp.get('tab') === 'trending' ? 'trending' : 'albums';
	const sort = SORTS.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'rating';
	const genre = sp.get('genre') || null;
	const decade = Number(sp.get('decade')) || null;
	const year = Number(sp.get('year')) || null;
	const sb = locals.supabase;

	const [albums, tracks, dist, genres, decadesRows] = await Promise.all([
		tab === 'albums' ? sb.rpc('charts_albums', { p_sort: sort, p_genre: genre, p_decade: decade, p_year: year, p_min: 1, p_limit: 50, p_offset: 0 }) : null,
		tab === 'tracks' ? sb.rpc('charts_tracks', { p_sort: sort === 'count' ? 'count' : 'rating', p_min: 1, p_limit: 50, p_offset: 0 }) : null,
		sb.rpc('community_distribution'),
		sb.rpc('rated_genres', { p_limit: 30 }),
		sb.from('catalog_items').select('release_year').eq('kind', 'album').not('release_year', 'is', null).order('release_year', { ascending: false }).limit(2000)
	]);
	const decades = [...new Set(((decadesRows.data as { release_year: number }[] | null) ?? []).map((r) => Math.floor(r.release_year / 10) * 10))].sort((a, b) => b - a);
	const d = ((dist.data as { bucket: number; n: number }[] | null) ?? []).map((x) => ({ bucket: Number(x.bucket), n: x.n }));
	const total = d.reduce((s, b) => s + b.n, 0);
	const mean = total ? d.reduce((s, b) => s + b.bucket * b.n, 0) / total : null;
	const mode = d.length ? d.reduce((best, b) => (b.n > best.n ? b : best), d[0]) : null;

	return {
		tab,
		sort,
		albums: (albums?.data as Record<string, unknown>[] | null) ?? [],
		tracks: (tracks?.data as Record<string, unknown>[] | null) ?? [],
		distribution: d,
		summary: { total, mean, mode: total ? mode?.bucket : null },
		genres: ((genres.data as { genre: string; n: number }[] | null) ?? []).map((g) => g.genre),
		decades,
		trending: tab === 'trending' ? trendingAlbums(20) : Promise.resolve([])
	};
};
