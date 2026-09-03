import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { config } from '$lib/config';
import type { LayoutLoad } from './$types';

/**
 * Creates the Supabase client the browser uses (realtime subscriptions, a few reads).
 * On the server this runs with the request's cookies so the first render matches.
 * Writes go through server routes (src/routes/api), not through this client.
 */
export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	const supabase = isBrowser()
		? createBrowserClient(config.supabaseUrl, config.supabaseKey, { global: { fetch } })
		: createServerClient(config.supabaseUrl, config.supabaseKey, {
				global: { fetch },
				cookies: { getAll: () => data.cookies }
			});

	return { supabase, session: data.session, user: data.user, profile: data.profile };
};
