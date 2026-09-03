import type { PageServerLoad } from './$types';
import type { ProfileCard } from '$lib/types';

type Card = ProfileCard & { status_text?: string | null; status_emoji?: string | null };
type FollowRow = { created_at: string; profile: Card | Card[] };
const one = (p: Card | Card[]) => (Array.isArray(p) ? p[0] : p);

/** Friends = mutual follows (Letterboxd model). One-way follows are listed either side of that. */
export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user!.id;
	const sb = locals.supabase;
	const cols = 'id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji';
	const [{ data: following }, { data: followers }, { data: live }, { data: blocks }] = await Promise.all([
		sb.from('follows').select(`created_at, profile:profiles!follows_following_id_fkey(${cols})`).eq('follower_id', me).order('created_at', { ascending: false }),
		sb.from('follows').select(`created_at, profile:profiles!follows_follower_id_fkey(${cols})`).eq('following_id', me).order('created_at', { ascending: false }),
		sb.rpc('friends_now_playing'),
		sb.from('friendships').select(`requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${cols}), addressee:profiles!friendships_addressee_id_fkey(${cols})`).eq('status', 'blocked').eq('blocked_by', me)
	]);
	const iFollow = ((following as unknown as FollowRow[]) ?? []).map((r) => ({ ...one(r.profile), since: r.created_at }));
	const followMe = ((followers as unknown as FollowRow[]) ?? []).map((r) => ({ ...one(r.profile), since: r.created_at }));
	const followingIds = new Set(iFollow.map((p) => p.id));
	const followerIds = new Set(followMe.map((p) => p.id));
	const liveMap = Object.fromEntries((((live as Record<string, unknown>[]) ?? []).map((l) => [l.id as string, l])));

	return {
		friends: iFollow.filter((p) => followerIds.has(p.id)).map((p) => ({ ...p, live: liveMap[p.id] ?? null })),
		followsYou: followMe.filter((p) => !followingIds.has(p.id)),
		youFollow: iFollow.filter((p) => !followerIds.has(p.id)),
		blocked: ((blocks as unknown as { requester_id: string; requester: Card | Card[]; addressee: Card | Card[] }[]) ?? []).map((b) => one(b.requester_id === me ? b.addressee : b.requester))
	};
};
