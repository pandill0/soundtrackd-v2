/**
 * Single source of truth for public configuration (REBUILD-SPEC §2, §6).
 * Values come from environment variables — locally from .env, in production from Netlify.
 * Never add a secret here: everything in this file can end up in the browser.
 */
import { env } from '$env/dynamic/public';

export const config = {
	siteName: 'Soundtrackd',
	version: '2.0.0-beta',
	siteUrl: (env.PUBLIC_SITE_URL || 'https://soundtrackd.org').replace(/\/$/, ''),
	supabaseUrl: env.PUBLIC_SUPABASE_URL,
	supabaseKey: env.PUBLIC_SUPABASE_KEY,
	/** Now-playing older than this stops rendering (§8.1). */
	nowPlayingMaxAgeMinutes: 30,
	/** Username rules shared by signup, the welcome step, and the DB constraint. */
	username: {
		pattern: /^[A-Za-z0-9_]{3,20}$/,
		reserved: [
			'admin',
			'administrator',
			'soundtrackd',
			'support',
			'supporters',
			'api',
			'auth',
			'login',
			'logout',
			'signup',
			'welcome',
			'dash',
			'profile',
			'album',
			'artist',
			'song',
			'search',
			'charts',
			'lists',
			'list',
			'members',
			'friends',
			'messages',
			'queue',
			'settings',
			'notifications',
			'me'
		]
	}
} as const;

if (!config.supabaseUrl || !config.supabaseKey) {
	throw new Error(
		'Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY. Copy .env.example to .env (see SETUP.md).'
	);
}
