import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateUsername } from '$lib/server/auth-utils';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (locals.profile?.username_set !== false) redirect(303, '/dash');
	const meta = locals.user.user_metadata ?? {};
	const suggestion = String(meta.name ?? meta.full_name ?? locals.user.email?.split('@')[0] ?? '')
		.replace(/[^A-Za-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 20);
	return { suggestion, email: locals.user.email ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const u = validateUsername(String(form.get('username') ?? ''));
		if (!u.ok) return fail(400, { error: u.error, username: String(form.get('username') ?? '') });
		const { error } = await locals.supabase.rpc('set_username', { p_username: u.username });
		if (error) {
			const msg = /unavailable/i.test(error.message) ? 'That username is taken.' : error.message;
			return fail(400, { error: msg, username: u.username });
		}
		redirect(303, '/dash');
	}
};
