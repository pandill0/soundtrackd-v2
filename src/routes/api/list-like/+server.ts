import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in to like lists');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.list_id)) error(400, 'Bad list');
	const { error: err } = await locals.supabase.from('list_likes').upsert({ user_id: locals.user.id, list_id: b.list_id }, { onConflict: 'user_id,list_id', ignoreDuplicates: true });
	if (err) error(400, err.message);
	return json({ liked: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const b = await request.json().catch(() => ({}));
	if (!isUuid(b.list_id)) error(400, 'Bad list');
	const { error: err } = await locals.supabase.from('list_likes').delete().eq('user_id', locals.user.id).eq('list_id', b.list_id);
	if (err) error(400, err.message);
	return json({ liked: false });
};
