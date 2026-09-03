import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const SORTS = new Set(['updated', 'likes', 'items', 'created']);

export const load: PageServerLoad = async ({ url, locals }) => {
	const sort = SORTS.has(url.searchParams.get('sort') ?? '') ? url.searchParams.get('sort')! : 'updated';
	const type = ['albums', 'songs', 'mixed'].includes(url.searchParams.get('type') ?? '') ? url.searchParams.get('type') : null;
	const { data } = await locals.supabase.rpc('lists_directory', { p_sort: sort, p_type: type, p_user: null, p_limit: 60, p_offset: 0 });
	return { lists: (data as Record<string, unknown>[] | null) ?? [], openNew: url.searchParams.get('new') === '1' };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login?next=/lists?new=1');
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim().slice(0, 120);
		const description = String(form.get('description') ?? '').trim().slice(0, 2000) || null;
		const type = String(form.get('type') ?? 'albums');
		if (!title) return fail(400, { error: 'Give the list a title.' });
		if (!['albums', 'songs', 'mixed'].includes(type)) return fail(400, { error: 'Bad type.' });
		const { data, error } = await locals.supabase.from('lists').insert({ user_id: locals.user.id, title, description, type, items: [] }).select('id').single();
		if (error) return fail(400, { error: error.message });
		redirect(303, `/list/${data.id}?edit=1`);
	}
};
