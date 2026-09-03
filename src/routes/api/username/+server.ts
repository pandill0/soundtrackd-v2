import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateUsername } from '$lib/server/auth-utils';

/** GET /api/username?u=name → { available: boolean } (live check for signup / welcome forms). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const u = validateUsername(url.searchParams.get('u') ?? '');
	if (!u.ok) return json({ available: false, reason: u.error });
	const { data } = await locals.supabase.rpc('username_available', { p_username: u.username });
	return json({ available: data === true });
};
