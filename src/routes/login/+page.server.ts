import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { safeNext, validateUsername } from '$lib/server/auth-utils';

const REMEMBER_COOKIE = 'st_remember';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return {
		next: safeNext(url.searchParams.get('next')),
		mode: url.searchParams.get('mode') === 'signup' ? 'signup' : 'signin',
		message: url.searchParams.get('message')
	};
};

/**
 * "Remember me" (§5): the auth cookies become session cookies when unchecked. The choice is
 * remembered in its own cookie so token refreshes keep honouring it — see src/lib/supabase/server.ts.
 */
function rememberChoice(event: Parameters<NonNullable<Actions[string]>>[0], remember: boolean) {
	event.locals.remember = remember;
	event.cookies.set(REMEMBER_COOKIE, remember ? '1' : '0', {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		httpOnly: true,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:'
	});
}

export const actions: Actions = {
	signin: async (event) => {
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? ''));
		if (!email || !password) return fail(400, { action: 'signin', email, error: 'Email and password are both required.' });

		rememberChoice(event, form.get('remember') === 'on');
		const { error } = await event.locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			const msg = /invalid login/i.test(error.message)
				? 'Wrong email or password.'
				: /not confirmed/i.test(error.message)
					? 'Please confirm your email first — check your inbox for the link.'
					: error.message;
			return fail(400, { action: 'signin', email, error: msg });
		}
		redirect(303, next);
	},

	signup: async (event) => {
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? ''));
		const u = validateUsername(String(form.get('username') ?? ''));
		const values = { action: 'signup', email, username: String(form.get('username') ?? '') };
		if (!u.ok) return fail(400, { ...values, error: u.error });
		if (!email) return fail(400, { ...values, error: 'Email is required.' });
		if (password.length < 8) return fail(400, { ...values, error: 'Use a password of at least 8 characters.' });

		// Uniqueness is checked BEFORE the account exists (§5) — and again by the DB trigger.
		const { data: available, error: checkErr } = await event.locals.supabase.rpc('username_available', { p_username: u.username });
		if (checkErr) return fail(500, { ...values, error: 'Could not check that username right now. Try again in a moment.' });
		if (available === false) return fail(400, { ...values, error: 'That username is taken.' });

		rememberChoice(event, form.get('remember') === 'on');
		const { data, error } = await event.locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: { username: u.username },
				emailRedirectTo: `${event.url.origin}/auth/callback?next=${encodeURIComponent(next)}`
			}
		});
		if (error) return fail(400, { ...values, error: error.message });
		if (data.session) redirect(303, next); // email confirmation disabled → straight in
		return {
			action: 'signup',
			success: true,
			email,
			message: `Almost there — we sent a confirmation link to ${email}. Open it, then sign in.`
		};
	},

	google: async (event) => {
		const form = await event.request.formData();
		const next = safeNext(String(form.get('next') ?? ''));
		rememberChoice(event, form.get('remember') !== 'off');
		const { data, error } = await event.locals.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${event.url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
				skipBrowserRedirect: true
			}
		});
		if (error || !data?.url) {
			return fail(400, { action: 'google', error: error?.message ?? 'Google sign-in is not enabled yet.' });
		}
		redirect(303, data.url);
	},

	reset: async (event) => {
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) return fail(400, { action: 'reset', error: 'Enter your email address.' });
		await event.locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${event.url.origin}/auth/callback?next=${encodeURIComponent('/settings?tab=password')}`
		});
		return { action: 'reset', success: true, email, message: 'If that address has an account, a reset link is on its way.' };
	}
};
