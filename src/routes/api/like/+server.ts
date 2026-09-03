import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const body = async (request: Request) => {
	const b = await request.json().catch(() => ({}));
	if (typeof b.rating_id !== 'string') error(400, 'Missing rating_id');
	return b as { rating_id: string };
};

/** Like / unlike a review. The notification is written by a DB trigger (§9). */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to like reviews');
	const { rating_id } = await body(request);
	const { error: err } = await locals.supabase
		.from('review_likes')
		.upsert({ user_id: locals.user.id, rating_id }, { onConflict: 'user_id,rating_id', ignoreDuplicates: true });
	if (err) error(400, err.message);
	return json({ liked: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { rating_id } = await body(request);
	const { error: err } = await locals.supabase.from('review_likes').delete().eq('user_id', locals.user.id).eq('rating_id', rating_id);
	if (err) error(400, err.message);
	return json({ liked: false });
};
