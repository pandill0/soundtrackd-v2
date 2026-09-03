import type { PageServerLoad } from './$types';
import { heroCovers, trendingAlbums } from '$lib/server/catalog';

/** The logged-out landing page (§8.2). Signed-in users are redirected to /dash by the hooks. */
export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;
	const [covers, reviews, lists, starters] = await Promise.all([
		heroCovers(72),
		sb.rpc('recent_reviews', { p_limit: 6 }),
		sb.rpc('lists_directory', { p_sort: 'likes', p_type: null, p_user: null, p_limit: 4, p_offset: 0 }),
		sb.rpc('charts_albums', { p_sort: 'count', p_genre: null, p_decade: null, p_year: null, p_min: 2, p_limit: 8, p_offset: 0 })
	]);
	const trending = trendingAlbums(10).catch(() => []);
	const trendingStats = trending.then(async (albums) => {
		if (!albums.length) return {};
		const { data } = await sb.rpc('item_stats', { p_ids: albums.map((a) => a.id) });
		return Object.fromEntries((((data as { catalog_item_id: string; avg_rating: number | null; rating_count: number }[] | null) ?? []).map((s) => [s.catalog_item_id, s])));
	});
	return {
		covers,
		reviews: (reviews.data as Record<string, unknown>[] | null) ?? [],
		lists: (lists.data as Record<string, unknown>[] | null) ?? [],
		starters: (starters.data as Record<string, unknown>[] | null) ?? [],
		trending,
		trendingStats
	};
};
