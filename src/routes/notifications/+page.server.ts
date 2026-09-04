import type { PageServerLoad } from './$types';
import type { Notification } from '$lib/types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	const me = locals.user!.id;
	const sb = locals.supabase;
	const { data } = await sb
		.from('notifications')
		.select('*, from_profile:profiles!notifications_from_user_id_fkey(id, username, avatar_url, accent_color, supporter_until)')
		.eq('user_id', me)
		.order('created_at', { ascending: false })
		.limit(80);
	const items = ((data as unknown as Notification[]) ?? []).map((n) => ({ ...n, from_profile: Array.isArray(n.from_profile) ? n.from_profile[0] : n.from_profile }));

	// Resolve which album a liked review belongs to.
	const likeRefs = items.filter((n) => n.type === 'review_like' && n.ref_id).map((n) => n.ref_id as string);
	const albums: Record<string, { catalog_item_id: string | null; album_title: string | null }> = {};
	if (likeRefs.length) {
		const { data: r } = await sb.from('ratings').select('id, catalog_item_id, album_title').in('id', likeRefs);
		for (const row of r ?? []) albums[row.id] = row;
	}

	// Opening the page marks everything read; the page then refreshes the nav badge.
	const hadUnread = items.some((n) => !n.read);
	if (hadUnread) await sb.from('notifications').update({ read: true }).eq('user_id', me).eq('read', false);

	return { items, albums, hadUnread };
};
