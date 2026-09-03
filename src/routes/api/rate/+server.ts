import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidRating } from '$lib/stars';

/**
 * POST   { kind, id, rating, review? } → upsert (rate_item RPC, runs as the signed-in user)
 * DELETE { kind, id }                  → remove your rating
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to rate');
	const body = await request.json().catch(() => ({}));
	const kind = body.kind === 'track' ? 'track' : 'album';
	const rating = Number(body.rating);
	if (typeof body.id !== 'string' || !isValidRating(rating)) error(400, 'Invalid rating');
	const review = typeof body.review === 'string' ? body.review.slice(0, 4000) : null;

	const { data, error: err } = await locals.supabase.rpc('rate_item', {
		p_kind: kind,
		p_item: body.id,
		p_rating: rating,
		p_review: review
	});
	if (err) error(400, err.message);
	return json(data);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const body = await request.json().catch(() => ({}));
	if (typeof body.id !== 'string') error(400, 'Missing id');
	const { error: err } = await locals.supabase.rpc('unrate_item', {
		p_kind: body.kind === 'track' ? 'track' : 'album',
		p_item: body.id
	});
	if (err) error(400, err.message);
	return json({ ok: true });
};
