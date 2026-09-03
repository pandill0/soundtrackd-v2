/**
 * The browser-side Supabase client, created once. Used only for things the browser must do
 * itself (realtime subscriptions, listening for auth changes). Reads and writes go through
 * server loads and API routes, which run as the signed-in user under Row Level Security.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from '$lib/config';

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
	if (typeof window === 'undefined') throw new Error('getBrowserClient() is browser-only');
	client ??= createBrowserClient(config.supabaseUrl, config.supabaseKey);
	return client;
}
