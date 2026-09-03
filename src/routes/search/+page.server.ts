import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/server/catalog';
import type { CatalogItem, CatalogKind } from '$lib/types';

type Stat = { catalog_item_id: string; rating_count: number; avg_rating: number | null; my_rating: number | null };

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const kindParam = url.searchParams.get('kind') ?? 'all';
	const kind = (['all', 'album', 'track', 'artist'].includes(kindParam) ? kindParam : 'all') as 'all' | CatalogKind;
	const sort = url.searchParams.get('sort') ?? 'relevance';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const genre = url.searchParams.get('genre') || null;
	const decade = Number(url.searchParams.get('decade')) || null;

	if (q.length < 2) return { q, kind, results: null, stats: {}, trackStats: {}, members: [], queued: [], genres: [], decades: [] };

	const sb = locals.supabase;
	const [results, members] = await Promise.all([
		searchCatalog(q, kind, 24),
		kind === 'all' ? sb.rpc('members_directory', { p_q: q, p_sort: 'username', p_limit: 6, p_offset: 0 }) : null
	]);

	const albumIds = results.albums.map((a) => a.id);
	const trackIds = results.tracks.map((t) => t.id);
	const [stats, trackStats, queued] = await Promise.all([
		albumIds.length ? sb.rpc('item_stats', { p_ids: albumIds }) : null,
		trackIds.length ? sb.rpc('track_item_stats', { p_ids: trackIds }) : null,
		locals.user && albumIds.length ? sb.from('listen_queue').select('catalog_item_id').eq('user_id', locals.user.id).in('catalog_item_id', albumIds) : null
	]);
	const statMap = Object.fromEntries((((stats?.data as Stat[] | null) ?? []).map((s) => [s.catalog_item_id, s])));
	const trackStatMap = Object.fromEntries((((trackStats?.data as Stat[] | null) ?? []).map((s) => [s.catalog_item_id, s])));

	// Search results are ≤24 provider rows: filtering/sorting this small set here is the one
	// documented exception to "sorting happens in Postgres" (§8.3).
	const keep = (i: CatalogItem) =>
		(!genre || i.genres.includes(genre)) && (!decade || ((i.release_year ?? 0) >= decade && (i.release_year ?? 0) < decade + 10));
	const order = (a: CatalogItem, b: CatalogItem, m: Record<string, Stat>) => {
		const sign = dir === 'asc' ? 1 : -1;
		if (sort === 'year') return ((a.release_year ?? 0) - (b.release_year ?? 0)) * sign;
		if (sort === 'rating') return ((m[a.id]?.avg_rating ?? -1) - (m[b.id]?.avg_rating ?? -1)) * sign;
		return 0;
	};
	const albums = results.albums.filter(keep).sort((a, b) => order(a, b, statMap));
	const tracks = results.tracks.filter(keep).sort((a, b) => order(a, b, trackStatMap));
	const genres = [...new Set([...results.albums, ...results.tracks].flatMap((i) => i.genres))].sort();
	const decades = [...new Set([...results.albums, ...results.tracks].map((i) => i.release_year).filter((y): y is number => !!y).map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);

	return {
		q,
		kind,
		results: { albums, tracks, artists: results.artists },
		stats: statMap,
		trackStats: trackStatMap,
		members: (members?.data as { id: string; username: string; avatar_url: string | null; accent_color: string | null; supporter_until: string | null; review_count: number }[] | null) ?? [],
		queued: ((queued?.data as { catalog_item_id: string }[] | null) ?? []).map((r) => r.catalog_item_id),
		genres,
		decades
	};
};
