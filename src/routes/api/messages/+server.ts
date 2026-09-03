import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** POST { conversation_id, body, shared_item_id? } — RLS enforces membership and blocks (§8.1). */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.conversation_id)) error(400, 'Bad conversation');
	const body = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : '';
	const shared = isUuid(b.shared_item_id) ? b.shared_item_id : null;
	if (!body && !shared) error(400, 'Say something');
	const { data, error: err } = await locals.supabase
		.from('messages')
		.insert({ conversation_id: b.conversation_id, sender_id: locals.user.id, body: body || '🎵', shared_item_id: shared })
		.select('*')
		.single();
	if (err) error(403, /row-level security/i.test(err.message) ? 'You cannot message this person.' : err.message);
	return json(data);
};

/** DELETE { id } — soft-delete your own message. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.id)) error(400, 'Bad id');
	const { error: err } = await locals.supabase
		.from('messages')
		.update({ deleted_at: new Date().toISOString(), body: '[deleted]', shared_item_id: null })
		.eq('id', b.id)
		.eq('sender_id', locals.user.id);
	if (err) error(400, err.message);
	return json({ ok: true });
};
