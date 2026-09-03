import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTrack } from '$lib/server/catalog';
import { fetchLyrics } from '$lib/server/lyrics';
import { isUuid } from '$lib/utils';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!isUuid(params.id)) error(404, 'Song not found');
	const detail = await getTrack(params.id);
	if (!detail) error(404, 'Song not found');
	const { track, album, artist } = detail;

	const sb = locals.supabase;
	const uid = locals.user?.id ?? null;
	const reviewSort = url.searchParams.get('reviews') === 'top' ? 'top' : 'recent';
	const artistName = artist?.title ?? track.artist_name ?? '';

	const [stats, dist, mine, reviews, friends] = await Promise.all([
		sb.from('track_stats').select('*').eq('catalog_item_id', track.id).maybeSingle(),
		sb.rpc('rating_distribution', { p_kind: 'track', p_item: track.id }),
		uid ? sb.from('track_ratings').select('id, rating, review').eq('user_id', uid).eq('catalog_item_id', track.id).maybeSingle() : null,
		sb.rpc('reviews_for_item', { p_kind: 'track', p_item: track.id, p_sort: reviewSort, p_limit: 30, p_offset: 0 }),
		uid ? sb.rpc('followed_ratings_for_item', { p_kind: 'track', p_item: track.id, p_limit: 12 }) : null
	]);

	return {
		track,
		album,
		artist,
		stats: (stats.data as { rating_count: number; avg_rating: number | null; review_count: number } | null) ?? null,
		distribution: ((dist.data as { bucket: number; n: number }[] | null) ?? []).map((d) => ({ bucket: Number(d.bucket), n: d.n })),
		myRating: (mine?.data as { id: string; rating: number; review: string | null } | null) ?? null,
		reviews: (reviews.data as Record<string, unknown>[] | null) ?? [],
		reviewSort,
		friends: (friends?.data as Record<string, unknown>[] | null) ?? [],
		// Streamed: the page renders before lyrics.ovh answers (it often doesn't).
		lyrics: artistName ? fetchLyrics(artistName, track.title) : Promise.resolve(null)
	};
};
