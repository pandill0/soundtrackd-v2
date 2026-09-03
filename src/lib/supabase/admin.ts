/**
 * Service-role client. SERVER ONLY. Bypasses Row Level Security.
 * Used by exactly two things: the catalogue module (the only writer of catalog_items, §4)
 * and background jobs. Never pass it to a load function's return value.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '$lib/config';
import { serverEnv } from '$lib/server/env';

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
	if (!serverEnv.supabaseSecretKey) return null;
	if (!cached) {
		cached = createClient(config.supabaseUrl, serverEnv.supabaseSecretKey, {
			auth: { persistSession: false, autoRefreshToken: false }
		});
	}
	return cached;
}
