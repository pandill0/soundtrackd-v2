/**
 * Server-only configuration. Importing this file from browser code is a build error
 * (SvelteKit blocks `$lib/server` imports from client bundles), which is the point.
 */
import { env } from '$env/dynamic/private';

export const serverEnv = {
	/** Supabase secret key — the only credential allowed to write catalog_items (§4). */
	supabaseSecretKey: env.SUPABASE_SECRET_KEY || '',
	lastfmApiKey: env.LASTFM_API_KEY || '',
	musicbrainzContact: env.MUSICBRAINZ_CONTACT || 'hello@soundtrackd.org',
	jobsSecret: env.JOBS_SECRET || '',
	lemonSqueezy: {
		checkoutUrl: env.LEMONSQUEEZY_CHECKOUT_URL || '',
		webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET || ''
	},
	affiliate: {
		amazonTag: env.AFFILIATE_AMAZON_TAG || '',
		ticketmasterTag: env.AFFILIATE_TICKETMASTER_TAG || ''
	}
};

export const hasSecretKey = () => serverEnv.supabaseSecretKey.length > 0;
