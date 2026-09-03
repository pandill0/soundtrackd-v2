import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getItems } from '$lib/server/catalog';
import { isUuid } from '$lib/utils';
import type { List, ListItem, ProfileCard } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!isUuid(params.id)) error(404, 'List not found');
	const sb = locals.supabase;
	const { data } = await sb
		.from('lists')
		.select('*, profiles:profiles!lists_user_id_fkey(id, username, avatar_url, accent_color, supporter_until)')
		.eq('id', params.id)
		.maybeSingle();
	if (!data) error(404, 'List not found');
	const list = data as unknown as List & { profiles: ProfileCard | ProfileCard[] };
	const owner = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;
	const own = locals.user?.id === list.user_id;

	const [{ count }, liked] = await Promise.all([
		sb.from('list_likes').select('*', { count: 'exact', head: true }).eq('list_id', list.id),
		locals.user ? sb.from('list_likes').select('list_id').eq('list_id', list.id).eq('user_id', locals.user.id).maybeSingle() : null
	]);
	const items = (list.items ?? []) as ListItem[];
	const ids = items.map((i) => i.catalogId).filter((x): x is string => !!x);
	const stats = ids.length ? await sb.rpc('item_stats', { p_ids: ids }) : null;
	const catalog = ids.length ? await getItems(ids) : [];

	return {
		list: { ...list, items, profiles: undefined },
		owner,
		own,
		editing: own && url.searchParams.get('edit') === '1',
		likeCount: count ?? 0,
		liked: !!liked?.data,
		stats: Object.fromEntries((((stats?.data as { catalog_item_id: string; rating_count: number; avg_rating: number | null; my_rating: number | null }[] | null) ?? []).map((s) => [s.catalog_item_id, s]))),
		catalog: Object.fromEntries(catalog.map((c) => [c.id, c]))
	};
};

const ownList = async (locals: App.Locals, id: string) => {
	if (!locals.user) return null;
	const { data } = await locals.supabase.from('lists').select('id, user_id').eq('id', id).maybeSingle();
	return data && data.user_id === locals.user.id ? data : null;
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		if (!(await ownList(locals, params.id))) return fail(403, { error: 'Not your list.' });
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim().slice(0, 120);
		if (!title) return fail(400, { error: 'A list needs a title.' });
		const { error: err } = await locals.supabase
			.from('lists')
			.update({ title, description: String(form.get('description') ?? '').trim().slice(0, 2000) || null })
			.eq('id', params.id);
		if (err) return fail(400, { error: err.message });
		return { success: true };
	},
	items: async ({ request, locals, params }) => {
		if (!(await ownList(locals, params.id))) return fail(403, { error: 'Not your list.' });
		const form = await request.formData();
		let items: ListItem[] = [];
		try {
			items = JSON.parse(String(form.get('items') ?? '[]'));
		} catch {
			return fail(400, { error: 'Bad items.' });
		}
		if (!Array.isArray(items) || items.length > 500) return fail(400, { error: 'Too many items.' });
		const clean = items.map((i) => ({
			id: String(i.id ?? '').slice(0, 80),
			catalogId: isUuid(i.catalogId) ? i.catalogId : null,
			type: i.type === 'track' ? 'track' : 'album',
			title: String(i.title ?? '').slice(0, 200),
			artist: String(i.artist ?? '').slice(0, 200),
			cover: String(i.cover ?? '').slice(0, 500),
			albumId: isUuid(i.albumId) ? i.albumId : null
		}));
		const { error: err } = await locals.supabase.from('lists').update({ items: clean }).eq('id', params.id);
		if (err) return fail(400, { error: err.message });
		return { success: true };
	},
	delete: async ({ locals, params }) => {
		if (!(await ownList(locals, params.id))) return fail(403, { error: 'Not your list.' });
		await locals.supabase.from('lists').delete().eq('id', params.id);
		redirect(303, '/lists');
	}
};
