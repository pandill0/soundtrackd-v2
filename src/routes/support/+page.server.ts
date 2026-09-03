import type { PageServerLoad } from './$types';
import { serverEnv } from '$lib/server/env';
import { isSupporter } from '$lib/entitlements';

/** The single supporter tier (§13.2B): $18/yr, cosmetic only, hosted checkout. */
export const load: PageServerLoad = async ({ locals }) => {
	const base = serverEnv.lemonSqueezy.checkoutUrl;
	let checkoutUrl: string | null = null;
	if (base && locals.user) {
		// Lemon Squeezy hosted checkouts accept prefill + custom data as query params; the webhook
		// gets custom_data.user_id back so we know whom to grant.
		const u = new URL(base);
		u.searchParams.set('checkout[custom][user_id]', locals.user.id);
		if (locals.user.email) u.searchParams.set('checkout[email]', locals.user.email);
		checkoutUrl = u.toString();
	}
	return {
		configured: !!base,
		checkoutUrl,
		supporter: isSupporter(locals.profile),
		until: locals.profile?.supporter_until ?? null,
		since: locals.profile?.supporter_since ?? null
	};
};
