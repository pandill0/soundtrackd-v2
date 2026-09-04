import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getItems } from '$lib/server/catalog';
import { isUuid } from '$lib/utils';
import type { Message, ProfileCard } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	depends('app:unread');
	if (!isUuid(params.id)) error(404, 'Conversation not found');
	const sb = locals.supabase;
	const me = locals.user!.id;

	// RLS: only members can see the conversation and its members.
	const { data: members } = await sb
		.from('conversation_members')
		.select('user_id, profile:profiles!user_id(id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji, last_seen_at)')
		.eq('conversation_id', params.id);
	if (!members?.length) error(404, 'Conversation not found');
	const other = (members as unknown as { user_id: string; profile: ProfileCard & { last_seen_at?: string | null } }[]).find((m) => m.user_id !== me)?.profile ?? null;
	if (!other) error(404, 'Conversation not found');

	const [{ data: msgs }, { data: block }] = await Promise.all([
		sb.from('messages').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }).limit(200),
		sb.rpc('is_blocked_between', { a: me, b: other.id })
	]);
	const messages = ((msgs as Message[]) ?? []);
	const sharedIds = [...new Set(messages.map((m) => m.shared_item_id).filter((x): x is string => !!x))];
	const items = sharedIds.length ? await getItems(sharedIds) : [];
	const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

	await sb.rpc('mark_conversation_read', { p_conv: params.id });

	return { conversationId: params.id, other, messages, itemMap, blocked: block === true };
};
