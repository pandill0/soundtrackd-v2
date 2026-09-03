import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.conversation_id)) error(400, 'Bad conversation');
	await locals.supabase.rpc('mark_conversation_read', { p_conv: b.conversation_id });
	return json({ ok: true });
};
