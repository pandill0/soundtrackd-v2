import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadFollowList } from '$lib/server/follow-list';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await loadFollowList(locals, params.username, 'followers');
	if (!result) error(404, 'No member by that name');
	return result;
};
