import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** Follow = the public one-way taste graph (§8.1). Notification comes from a DB trigger. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to follow people');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.user_id) || b.user_id === locals.user.id) error(400, 'Bad user');
	const { error: err } = await locals.supabase
		.from('follows')
		.upsert({ follower_id: locals.user.id, following_id: b.user_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
	if (err) error(400, err.message);
	return json({ following: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.user_id)) error(400, 'Bad user');
	const { error: err } = await locals.supabase.from('follows').delete().eq('follower_id', locals.user.id).eq('following_id', b.user_id);
	if (err) error(400, err.message);
	return json({ following: false });
};
