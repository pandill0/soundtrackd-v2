import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/**
 * Block / unblock. Friendship itself is derived from mutual follows (migration 8), so the only
 * explicit relationship writes left are blocks, done by SECURITY DEFINER functions.
 * POST { action: 'block' | 'unblock', user_id }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.user_id) || b.user_id === locals.user.id) error(400, 'Bad user');
	if (b.action !== 'block' && b.action !== 'unblock') error(400, 'Unknown action');
	const { error: err } = await locals.supabase.rpc(b.action === 'block' ? 'user_block' : 'user_unblock', { p_user: b.user_id });
	if (err) error(400, err.message);
	return json({ ok: true });
};
