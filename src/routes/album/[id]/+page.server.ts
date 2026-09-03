import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { albumsByArtist, catalogMode, getAlbum } from '$lib/server/catalog';
import { buildLinks } from '$lib/server/affiliate';
import { isUuid } from '$lib/utils';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!isUuid(params.id)) error(404, 'Album not found');
	const detail = await getAlbum(params.id);
	if (!detail) error(404, 'Album not found');
	const { album, artist, tracks } = detail;

	const sb = locals.supabase;
	const uid = locals.user?.id ?? null;
	const trackIds = tracks.map((t) => t.id);
	const reviewSort = url.searchParams.get('reviews') === 'top' ? 'top' : 'recent';

	const [stats, dist, mine, trackStats, reviews, friends, moreBy, queued] = await Promise.all([
		sb.from('album_stats').select('*').eq('catalog_item_id', album.id).maybeSingle(),
		sb.rpc('rating_distribution', { p_kind: 'album', p_item: album.id }),
		uid ? sb.from('ratings').select('id, rating, review').eq('user_id', uid).eq('catalog_item_id', album.id).maybeSingle() : null,
		trackIds.length ? sb.rpc('track_item_stats', { p_ids: trackIds }) : null,
		sb.rpc('reviews_for_item', { p_kind: 'album', p_item: album.id, p_sort: reviewSort, p_limit: 30, p_offset: 0 }),
		uid ? sb.rpc('followed_ratings_for_item', { p_kind: 'album', p_item: album.id, p_limit: 12 }) : null,
		artist ? albumsByArtist(artist.id, album.id, 6) : [],
		uid ? sb.from('listen_queue').select('catalog_item_id').eq('user_id', uid).eq('catalog_item_id', album.id).maybeSingle() : null
	]);

	type TS = { catalog_item_id: string; rating_count: number; avg_rating: number | null; my_rating: number | null };
	const trackStatMap: Record<string, TS> = {};
	for (const s of (trackStats?.data as TS[] | null) ?? []) trackStatMap[s.catalog_item_id] = s;
	const trophies = Object.values(trackStatMap)
		.filter((s) => s.rating_count > 0 && s.avg_rating != null)
		.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || b.rating_count - a.rating_count)
		.slice(0, 3)
		.map((s) => s.catalog_item_id);

	const moreIds = moreBy.map((a) => a.id);
	const moreStats = moreIds.length ? await sb.rpc('item_stats', { p_ids: moreIds }) : null;

	return {
		album,
		artist,
		tracks,
		stats: (stats.data as { rating_count: number; avg_rating: number | null; review_count: number } | null) ?? null,
		distribution: ((dist.data as { bucket: number; n: number }[] | null) ?? []).map((d) => ({ bucket: Number(d.bucket), n: d.n })),
		myRating: (mine?.data as { id: string; rating: number; review: string | null } | null) ?? null,
		trackStats: trackStatMap,
		trophies,
		reviews: (reviews.data as Record<string, unknown>[] | null) ?? [],
		reviewSort,
		friends: (friends?.data as Record<string, unknown>[] | null) ?? [],
		moreBy,
		moreStats: Object.fromEntries((((moreStats?.data as TS[] | null) ?? []).map((s) => [s.catalog_item_id, s]))),
		inQueue: !!queued?.data,
		nowSpinning: locals.profile?.now_playing_id === album.id,
		links: buildLinks({ kind: 'album', title: album.title, artist_name: album.artist_name }),
		devMode: catalogMode() === 'memory'
	};
};
