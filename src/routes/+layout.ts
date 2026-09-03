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

	const {
		data: { session }
	} = await supabase.auth.getSession();
	// Only what pages need: comparing expiry and authorising realtime. Never the unverified user object.
	const sessionLite = session ? { access_token: session.access_token, expires_at: session.expires_at ?? null } : null;
	return { supabase, session: sessionLite, user: data.user, profile: data.profile };
};
