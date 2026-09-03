import type { PageServerLoad } from './$types';
import type { Friendship, ProfileCard } from '$lib/types';

type Row = Friendship & { requester: ProfileCard; addressee: ProfileCard };

export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user!.id;
	const sb = locals.supabase;
	const [{ data: rows }, { data: live }] = await Promise.all([
		sb
			.from('friendships')
			.select('*, requester:profiles!friendships_requester_id_fkey(id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji), addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji)')
			.order('created_at', { ascending: false }),
		sb.rpc('friends_now_playing')
	]);
	const all = ((rows as unknown as Row[]) ?? []).map((r) => ({ ...r, other: r.requester_id === me ? r.addressee : r.requester }));
	const liveMap = Object.fromEntries((((live as Record<string, unknown>[]) ?? []).map((l) => [l.id as string, l])));
	return {
		friends: all.filter((r) => r.status === 'accepted').map((r) => ({ ...r, live: liveMap[r.other.id] ?? null })),
		incoming: all.filter((r) => r.status === 'pending' && r.addressee_id === me),
		outgoing: all.filter((r) => r.status === 'pending' && r.requester_id === me),
		blocked: all.filter((r) => r.status === 'blocked' && r.blocked_by === me)
	};
};
