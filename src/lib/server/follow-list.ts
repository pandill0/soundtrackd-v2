import { profileCards } from '$lib/server/profiles';

/** Shared loader for /profile/[username]/followers and /following. */
export async function loadFollowList(locals: App.Locals, username: string, which: 'followers' | 'following') {
	const sb = locals.supabase;
	const { data: profile } = await sb.from('profiles').select('id, username').ilike('username', username).maybeSingle();
	if (!profile) return null;

	const otherCol = which === 'followers' ? 'follower_id' : 'following_id';
	const whereCol = which === 'followers' ? 'following_id' : 'follower_id';
	const { data: rows } = await sb.from('follows').select(`${otherCol}, created_at`).eq(whereCol, profile.id).order('created_at', { ascending: false }).limit(200);
	const ids = ((rows as Record<string, string>[]) ?? []).map((r) => r[otherCol]);
	const cards = await profileCards(sb, ids);
	const people = ids.map((id) => cards[id]).filter(Boolean);

	let mine: string[] = [];
	let theirs: string[] = [];
	if (locals.user) {
		const [a, b] = await Promise.all([
			sb.from('follows').select('following_id').eq('follower_id', locals.user.id),
			sb.from('follows').select('follower_id').eq('following_id', locals.user.id)
		]);
		mine = (a.data ?? []).map((r) => r.following_id as string);
		theirs = (b.data ?? []).map((r) => r.follower_id as string);
	}
	return { username: profile.username, which, people, mine, theirs };
}
