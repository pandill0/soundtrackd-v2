import type { LayoutServerLoad } from './$types';

/**
 * Runs on every page. Auth state comes from here and only here (the hooks verified it).
 * Also fetches the two nav badges and records presence, throttled to once per five minutes.
 */
export const load: LayoutServerLoad = async ({ locals, cookies, depends, url }) => {
	depends('supabase:auth');
	depends('app:unread');
	let unread = { notifications: 0, messages: 0 };

	if (locals.user) {
		const { data } = await locals.supabase.rpc('unread_counts');
		if (data && typeof data === 'object') unread = { notifications: 0, messages: 0, ...data };

		if (!cookies.get('st_seen')) {
			await locals.supabase.rpc('touch_last_seen');
			cookies.set('st_seen', '1', {
				path: '/',
				maxAge: 300,
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:'
			});
		}
	}

	return {
		user: locals.user,
		profile: locals.profile,
		// Only what the browser needs: expiry for change detection, token for realtime. Never the unverified user object.
		session: locals.session ? { access_token: locals.session.access_token, expires_at: locals.session.expires_at ?? null } : null,
		unread
	};
};
