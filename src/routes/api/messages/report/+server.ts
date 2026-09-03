import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** Report a message (§8.1 — ships with messaging). Reports are only readable in the Supabase dashboard. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.message_id)) error(400, 'Bad message');
	const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 500) : null;
	const { error: err } = await locals.supabase
		.from('message_reports')
		.upsert({ reporter_id: locals.user.id, message_id: b.message_id, reason }, { onConflict: 'reporter_id,message_id' });
	if (err) error(400, err.message);
	return json({ ok: true });
};
