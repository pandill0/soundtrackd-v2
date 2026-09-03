import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** GET /api/members?q=… → member search for the friends page picker. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json([]);
	const { data } = await locals.supabase.rpc('members_directory', { p_q: q, p_sort: 'username', p_limit: 10, p_offset: 0 });
	return json(data ?? []);
};
