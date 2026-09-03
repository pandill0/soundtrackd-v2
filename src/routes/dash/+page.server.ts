import type { PageServerLoad } from './$types';
import { trendingAlbums } from '$lib/server/catalog';

/** The logged-in dashboard (§8.2): modules in priority order, each collapsing when empty. */
export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	const sb = locals.supabase;
	const me = locals.user!.id;

	const [feed, queue, friends, inbox, releases, stats, lists, week] = await Promise.all([
		sb.rpc('activity_feed', { p_limit: 30, p_before: null }),
		sb.rpc('queue_list', { p_user: null, p_sort: 'added', p_dir: 'desc', p_genre: null, p_decade: null }),
		sb.rpc('friends_now_playing'),
		sb.rpc('conversations_overview'),
		sb.rpc('new_releases_for_user', { p_days: 120, p_limit: 8 }),
		sb.rpc('profile_stats', { p_user: me }),
		sb.rpc('lists_directory', { p_sort: 'created', p_type: null, p_user: null, p_limit: 4, p_offset: 0 }),
		sb.rpc('charts_albums', { p_sort: 'trending', p_genre: null, p_decade: null, p_year: null, p_min: 1, p_limit: 6, p_offset: 0 })
	]);

	type Conv = { conversation_id: string; other_username: string; other_avatar: string | null; unread: number; last_body: string | null };
	const convs = ((inbox.data as Conv[] | null) ?? []).filter((c) => c.unread > 0);

	return {
		feed: (feed.data as Record<string, unknown>[] | null) ?? [],
		queue: ((queue.data as Record<string, unknown>[] | null) ?? []).slice(0, 4),
		friends: (friends.data as Record<string, unknown>[] | null) ?? [],
		unreadConvs: convs,
		releases: (releases.data as Record<string, unknown>[] | null) ?? [],
		stats: (stats.data as Record<string, unknown> & { distribution?: { bucket: number; n: number }[] }) ?? {},
		newLists: (lists.data as Record<string, unknown>[] | null) ?? [],
		week: (week.data as Record<string, unknown>[] | null) ?? [],
		trending: trendingAlbums(8).catch(() => [])
	};
};
