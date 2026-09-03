import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/**
 * Friendship actions (§8.1) — all go through SECURITY DEFINER functions in the database.
 * POST { action: 'request'|'accept'|'decline'|'remove'|'block'|'unblock', user_id?, id? }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	const sb = locals.supabase;
	let res: { error: { message: string } | null };
	switch (b.action) {
		case 'request':
			if (!isUuid(b.user_id)) error(400, 'Bad user');
			res = await sb.rpc('friend_request', { p_user: b.user_id });
			break;
		case 'accept':
		case 'decline':
			if (!isUuid(b.id)) error(400, 'Bad request id');
			res = await sb.rpc('friend_respond', { p_id: b.id, p_accept: b.action === 'accept' });
			break;
		case 'remove':
			if (!isUuid(b.user_id)) error(400, 'Bad user');
			res = await sb.rpc('friend_remove', { p_user: b.user_id });
			break;
		case 'block':
			if (!isUuid(b.user_id)) error(400, 'Bad user');
			res = await sb.rpc('user_block', { p_user: b.user_id });
			break;
		case 'unblock':
			if (!isUuid(b.user_id)) error(400, 'Bad user');
			res = await sb.rpc('user_unblock', { p_user: b.user_id });
			break;
		default:
			error(400, 'Unknown action');
	}
	if (res.error) error(400, res.error.message);
	return json({ ok: true });
};
