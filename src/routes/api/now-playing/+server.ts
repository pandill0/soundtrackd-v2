import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** "Now Spinning" — the manual now-playing path (§8.1). Expires after 30 minutes on read. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.id)) error(400, 'Missing id');
	const { error: err } = await locals.supabase
		.from('profiles')
		.update({ now_playing_id: b.id, now_playing_source: 'manual', now_playing_at: new Date().toISOString() })
		.eq('id', locals.user.id);
	if (err) error(400, err.message);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { error: err } = await locals.supabase
		.from('profiles')
		.update({ now_playing_id: null, now_playing_source: null, now_playing_at: null })
		.eq('id', locals.user.id);
	if (err) error(400, err.message);
	return json({ ok: true });
};
