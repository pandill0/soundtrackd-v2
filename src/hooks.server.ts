import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createSupabaseServerClient } from '$lib/supabase/server';
import type { Profile } from '$lib/types';
import { ensureProfile } from '$lib/server/ensure-profile';

/** Pages that need a signed-in user. Everything else is public. */
const PROTECTED = ['/dash', '/friends', '/messages', '/queue', '/notifications', '/settings', '/welcome'];

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	/**
	 * getSession() only reads the cookie; it does not verify the JWT. getUser() (or getClaims)
	 * asks Supabase Auth, so anything security-relevant must go through this helper.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	event.locals.profile = null;

	const path = event.url.pathname;

	if (user) {
		const { data } = await event.locals.supabase
			.from('profiles')
			.select('*')
			.eq('id', user.id)
			.maybeSingle();
		event.locals.profile = (data as Profile | null) ?? null;
		// An auth account with no profile row (v1 signup bug, §5) gets a placeholder and goes to /welcome.
		if (!event.locals.profile && !path.startsWith('/api') && !path.startsWith('/auth')) {
			event.locals.profile = await ensureProfile(event.locals.supabase, user);
		}

		// OAuth signups arrive without a username (§5). Nothing else is reachable until it's chosen.
		const needsUsername = event.locals.profile?.username_set === false;
		const onWelcome = path.startsWith('/welcome') || path.startsWith('/auth') || path.startsWith('/api');
		if (needsUsername && !onWelcome) redirect(303, '/welcome');
		if (!needsUsername && path === '/welcome') redirect(303, '/dash');

		// Logged-in users never see the marketing page (§8.2).
		if (path === '/' || path === '/login') redirect(303, '/dash');
	} else if (path === '/dash') {
		// Signed out: the intro page is the home page (§8.2).
		redirect(303, '/');
	} else if (PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
		redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}

	const response = await resolve(event);
	// Personalised pages must never be served from a cache (including the browser's back/forward
	// cache): after signing out, Back should not resurrect the dashboard.
	if (user && !path.startsWith('/api')) response.headers.set('cache-control', 'private, no-store');
	return response;
};

export const handle = sequence(supabase, authGuard);
