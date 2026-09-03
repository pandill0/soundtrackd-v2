import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isUuid } from '$lib/utils';

/** /messages/new?to=<user id> → opens (or creates) the 1:1 conversation. Friends only — the DB enforces it. */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const to = url.searchParams.get('to') ?? '';
	if (!isUuid(to)) redirect(303, '/messages');
	const { data, error } = await locals.supabase.rpc('get_or_create_conversation', { p_user: to });
	if (error || !data) redirect(303, `/friends?error=${encodeURIComponent(error?.message ?? 'Could not open a conversation')}`);
	redirect(303, `/messages/${data}`);
};
