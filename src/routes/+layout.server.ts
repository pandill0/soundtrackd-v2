import type { LayoutServerLoad } from './$types';

/**
 * Runs on every page. Besides auth state it fetches the two nav badges (unread notifications
 * and messages) and records presence, throttled to once every five minutes per browser.
 */
export const load: LayoutServerLoad = async ({ locals, cookies, depends, url }) => {
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
		session: locals.session,
		user: locals.user,
		profile: locals.profile,
		cookies: cookies.getAll(),
		unread
	};
};
