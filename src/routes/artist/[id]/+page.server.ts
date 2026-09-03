import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getArtist } from '$lib/server/catalog';
import { buildLinks } from '$lib/server/affiliate';
import { isUuid } from '$lib/utils';

const SORTS = new Set(['year', 'rating', 'mine', 'title']);

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!isUuid(params.id)) error(404, 'Artist not found');
	const detail = await getArtist(params.id);
	if (!detail) error(404, 'Artist not found');
	const { artist, albums, topTracks } = detail;

	const sb = locals.supabase;
	const sortParam = url.searchParams.get('sort') ?? 'year';
	const sort = SORTS.has(sortParam) ? sortParam : 'year';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const type = url.searchParams.get('type') || null;
	const decade = Number(url.searchParams.get('decade')) || null;

	const [discog, top, stats] = await Promise.all([
		sb.rpc('artist_discography', { p_artist: artist.id, p_sort: sort, p_dir: dir, p_type: type, p_decade: decade }),
		topTracks.length ? sb.rpc('track_item_stats', { p_ids: topTracks.map((t) => t.id) }) : null,
		sb.from('ratings').select('rating', { count: 'exact', head: false }).in('catalog_item_id', albums.map((a) => a.id)).limit(1000)
	]);

	type Row = { id: string; title: string; cover_url: string | null; release_year: number | null; record_type: string | null; rating_count: number; avg_rating: number | null; my_rating: number | null };
	let rows = (discog.data as Row[] | null) ?? [];
	// Pre-migration / dev fallback: the RPC knows nothing, so show what the catalogue module has.
	if (!rows.length && albums.length) {
		rows = albums
			.filter((a) => (!type || a.record_type === type) && (!decade || (a.release_year ?? 0) >= decade && (a.release_year ?? 0) < decade + 10))
			.map((a) => ({ id: a.id, title: a.title, cover_url: a.cover_url, release_year: a.release_year, record_type: a.record_type, rating_count: 0, avg_rating: null, my_rating: null }));
		if (sort === 'title') rows.sort((a, b) => a.title.localeCompare(b.title) * (dir === 'asc' ? 1 : -1));
		else rows.sort((a, b) => ((a.release_year ?? 0) - (b.release_year ?? 0)) * (dir === 'asc' ? 1 : -1));
	}

	const ratingsAll = (stats.data as { rating: number }[] | null) ?? [];
	const decades = [...new Set(albums.map((a) => a.release_year).filter((y): y is number => !!y).map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
	const types = [...new Set(albums.map((a) => a.record_type).filter((t): t is string => !!t))];

	return {
		artist,
		albums: rows,
		topTracks,
		topStats: Object.fromEntries((((top?.data as { catalog_item_id: string; rating_count: number; avg_rating: number | null; my_rating: number | null }[] | null) ?? []).map((s) => [s.catalog_item_id, s]))),
		summary: { ratings: ratingsAll.length, avg: ratingsAll.length ? ratingsAll.reduce((s, r) => s + Number(r.rating), 0) / ratingsAll.length : null, albums: albums.length },
		decades,
		types,
		links: buildLinks({ kind: 'artist', title: artist.title })
	};
};
