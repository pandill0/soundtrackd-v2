import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Discord-style status line (§8.1): up to 140 chars, optional emoji, optional expiry in hours. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	const text = typeof b.text === 'string' ? b.text.trim().slice(0, 140) : '';
	const emoji = typeof b.emoji === 'string' ? b.emoji.trim().slice(0, 8) : '';
	const hours = Number(b.expiresHours);
	const expires = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
	const { error: err } = await locals.supabase
		.from('profiles')
		.update({
			status_text: text || null,
			status_emoji: emoji || null,
			status_updated_at: new Date().toISOString(),
			status_expires_at: expires
		})
		.eq('id', locals.user.id);
	if (err) error(400, err.message);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { error: err } = await locals.supabase
		.from('profiles')
		.update({ status_text: null, status_emoji: null, status_updated_at: null, status_expires_at: null })
		.eq('id', locals.user.id);
	if (err) error(400, err.message);
	return json({ ok: true });
};
