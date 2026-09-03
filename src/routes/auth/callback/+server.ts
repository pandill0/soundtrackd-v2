import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { safeNext } from '$lib/server/auth-utils';

/**
 * Where Supabase sends people back to: Google OAuth, email confirmation, password reset.
 * Exchanges the one-time code for a session (cookies), then continues to `next`.
 * The hooks then route OAuth signups without a username to /welcome (§5).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const next = safeNext(url.searchParams.get('next'));
	const described = url.searchParams.get('error_description') ?? url.searchParams.get('error');
	if (described) redirect(303, `/login?message=${encodeURIComponent(described)}`);

	const code = url.searchParams.get('code');
	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (error) redirect(303, `/login?message=${encodeURIComponent(error.message)}`);
		redirect(303, next);
	}

	// Older email templates send token_hash + type instead of a PKCE code.
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	if (tokenHash && type) {
		const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (error) redirect(303, `/login?message=${encodeURIComponent(error.message)}`);
		redirect(303, type === 'recovery' ? '/settings?tab=password' : next);
	}

	redirect(303, '/login');
};
