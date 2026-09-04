import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileCard } from '$lib/types';

export type Card = ProfileCard & { status_text?: string | null; status_emoji?: string | null; last_seen_at?: string | null };
export const CARD_COLS = 'id, username, avatar_url, accent_color, supporter_until, status_text, status_emoji, last_seen_at';

/**
 * Profile cards for a set of user ids, as a map. Pages use this instead of PostgREST embeds so
 * they never depend on how (or whether) the v1 tables' foreign keys are declared.
 */
export async function profileCards(sb: SupabaseClient, ids: (string | null | undefined)[]): Promise<Record<string, Card>> {
	const uniq = [...new Set(ids.filter((x): x is string => !!x))];
	if (!uniq.length) return {};
	const { data } = await sb.from('profiles').select(CARD_COLS).in('id', uniq);
	return Object.fromEntries(((data as Card[]) ?? []).map((p) => [p.id, p]));
}
