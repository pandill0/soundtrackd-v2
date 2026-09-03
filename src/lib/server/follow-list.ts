import type { ProfileCard } from '$lib/types';

/** Shared loader for /profile/[username]/followers and /following. */
export async function loadFollowList(locals: App.Locals, username: string, which: 'followers' | 'following') {
	const sb = locals.supabase;
	const { data: profile } = await sb.from('profiles').select('id, username').ilike('username', username).maybeSingle();
	if (!profile) return null;

	const col = which === 'followers' ? 'follower_id' : 'following_id';
	const other = which === 'followers' ? 'following_id' : 'follower_id';
	const { data: rows } = await sb
		.from('follows')
		.select(`created_at, profile:profiles!follows_${col}_fkey ( id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji )`)
		.eq(other, profile.id)
		.order('created_at', { ascending: false })
		.limit(200);

	const people = ((rows as unknown as { profile: ProfileCard | ProfileCard[] }[]) ?? [])
		.map((r) => (Array.isArray(r.profile) ? r.profile[0] : r.profile))
		.filter(Boolean);

	let mine = new Set<string>();
	if (locals.user) {
		const { data } = await sb.from('follows').select('following_id').eq('follower_id', locals.user.id);
		mine = new Set((data ?? []).map((r) => r.following_id as string));
	}
	return { username: profile.username, which, people, mine: [...mine] };
}
