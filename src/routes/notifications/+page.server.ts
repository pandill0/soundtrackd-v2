import type { PageServerLoad } from './$types';
import { profileCards } from '$lib/server/profiles';
import type { Notification } from '$lib/types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	const me = locals.user!.id;
	const sb = locals.supabase;
	const { data } = await sb.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(80);
	const rows = ((data as Notification[]) ?? []);
	const people = await profileCards(sb, rows.map((n) => n.from_user_id));
	const items = rows.map((n) => ({ ...n, from_profile: n.from_user_id ? (people[n.from_user_id] ?? null) : null }));

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
