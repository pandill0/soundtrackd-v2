import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** The listen queue (§8.1): POST {id, note?} adds/updates, DELETE {id} removes. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to keep a queue');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.id)) error(400, 'Missing id');
	const note = typeof b.note === 'string' ? b.note.trim().slice(0, 280) || null : null;
	const { error: err } = await locals.supabase
		.from('listen_queue')
		.upsert({ user_id: locals.user.id, catalog_item_id: b.id, note }, { onConflict: 'user_id,catalog_item_id' });
	if (err) error(400, err.message);
	return json({ queued: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.id)) error(400, 'Missing id');
	const { error: err } = await locals.supabase.from('listen_queue').delete().eq('user_id', locals.user.id).eq('catalog_item_id', b.id);
	if (err) error(400, err.message);
	return json({ queued: false });
};
