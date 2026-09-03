import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	const { data } = await locals.supabase.rpc('conversations_overview');
	type Row = {
		conversation_id: string; other_id: string; other_username: string; other_avatar: string | null; other_accent: string | null;
		other_supporter_until: string | null; other_status_text: string | null; other_status_emoji: string | null;
		last_body: string | null; last_at: string | null; last_sender_id: string | null; last_shared_item_id: string | null; unread: number;
	};
	return { conversations: (data as Row[] | null) ?? [] };
};
