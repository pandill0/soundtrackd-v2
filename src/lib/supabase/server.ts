/**
 * Per-request Supabase client for server code (hooks, load functions, actions, API routes).
 * Runs as the signed-in user: Row Level Security applies exactly as it would in the browser.
 */
import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { config } from '$lib/config';

const ONE_YEAR = 60 * 60 * 24 * 365;

export function createSupabaseServerClient(event: RequestEvent) {
	return createServerClient(config.supabaseUrl, config.supabaseKey, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				// "Remember me" (§5): checked → persistent cookie; unchecked → session cookie that
				// dies with the browser. The choice is stored in its own cookie so token refreshes
				// keep honouring it. maxAge 0 is a deletion (sign-out) and must pass through.
				const remember = event.locals.remember ?? event.cookies.get('st_remember') !== '0';
				for (const { name, value, options } of cookiesToSet) {
					const { maxAge, expires, ...rest } = options;
					const deleting = maxAge === 0;
					event.cookies.set(name, value, {
						...rest,
						path: '/',
						...(deleting ? { maxAge: 0 } : remember ? { maxAge: ONE_YEAR } : {})
					});
				}
			}
		}
	});
}
