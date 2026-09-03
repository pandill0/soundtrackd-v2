import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from '$lib/types';

/**
 * Self-heal for accounts that exist in auth but have no profile row. v1's signup created the
 * profile from the browser after email confirmation (§5), so some accounts never got one.
 * We insert a placeholder (RLS allows inserting your own row) and the hooks then send the
 * person to /welcome to choose a real username, exactly like an OAuth signup.
 */
export async function ensureProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
	const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
	for (let attempt = 0; attempt < 3; attempt++) {
		const username = `listener_${Math.random().toString(16).slice(2, 10)}`;
		const { data, error } = await supabase
			.from('profiles')
			.insert({
				id: user.id,
				username,
				username_set: false,
				avatar_url: meta.avatar_url ?? meta.picture ?? null
			})
			.select('*')
			.maybeSingle();
		if (data) return data as Profile;
		// Someone else (a trigger, a parallel request) may have created it meanwhile.
		if (error?.code === '23505' && !/username/i.test(error.message)) break;
		if (error && error.code !== '23505') {
			console.error('[ensureProfile]', error.message);
			break;
		}
	}
	const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
	return (data as Profile | null) ?? null;
}
