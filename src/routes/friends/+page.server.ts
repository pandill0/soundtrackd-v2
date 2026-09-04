import type { PageServerLoad } from './$types';
import { profileCards } from '$lib/server/profiles';

/** Friends = mutual follows (Letterboxd model). One-way follows are listed either side of that. */
export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user!.id;
	const sb = locals.supabase;
	const [{ data: following }, { data: followers }, { data: live }, { data: blocks }] = await Promise.all([
		sb.from('follows').select('following_id, created_at').eq('follower_id', me).order('created_at', { ascending: false }),
		sb.from('follows').select('follower_id, created_at').eq('following_id', me).order('created_at', { ascending: false }),
		sb.rpc('friends_now_playing'),
		sb.from('friendships').select('requester_id, addressee_id').eq('status', 'blocked').eq('blocked_by', me)
	]);
	const fRows = (following as { following_id: string; created_at: string }[]) ?? [];
	const rRows = (followers as { follower_id: string; created_at: string }[]) ?? [];
	const bRows = (blocks as { requester_id: string; addressee_id: string }[]) ?? [];
	const blockedIds = bRows.map((b) => (b.requester_id === me ? b.addressee_id : b.requester_id));
	const cards = await profileCards(sb, [...fRows.map((r) => r.following_id), ...rRows.map((r) => r.follower_id), ...blockedIds]);

	const iFollow = fRows.map((r) => ({ ...cards[r.following_id], since: r.created_at })).filter((p) => p.id);
	const followMe = rRows.map((r) => ({ ...cards[r.follower_id], since: r.created_at })).filter((p) => p.id);
	const followingIds = new Set(iFollow.map((p) => p.id));
	const followerIds = new Set(followMe.map((p) => p.id));
	const liveMap = Object.fromEntries((((live as Record<string, unknown>[]) ?? []).map((l) => [l.id as string, l])));

	return {
		friends: iFollow.filter((p) => followerIds.has(p.id)).map((p) => ({ ...p, live: liveMap[p.id] ?? null })),
		followsYou: followMe.filter((p) => !followingIds.has(p.id)),
		youFollow: iFollow.filter((p) => !followerIds.has(p.id)),
		blocked: blockedIds.map((id) => cards[id]).filter(Boolean)
	};
};
