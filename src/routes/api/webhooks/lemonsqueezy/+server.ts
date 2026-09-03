import { createHmac, timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverEnv } from '$lib/server/env';
import { getAdminClient } from '$lib/supabase/admin';
import { isUuid } from '$lib/utils';

/**
 * Lemon Squeezy → Soundtrackd (§13.2B). The ONLY thing that grants supporter status.
 *  1. Verify the X-Signature HMAC before trusting anything.
 *  2. Map their subscription status onto ours.
 *  3. apply_subscription_event() is idempotent, so retries are harmless.
 * Configure the webhook in Lemon Squeezy with the same secret as LEMONSQUEEZY_WEBHOOK_SECRET and
 * subscribe to subscription_created / updated / cancelled / resumed / expired / paused / unpaused.
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = serverEnv.lemonSqueezy.webhookSecret;
	if (!secret) error(503, 'Webhook not configured');
	const raw = await request.text();
	const signature = request.headers.get('x-signature') ?? '';
	const expected = createHmac('sha256', secret).update(raw).digest('hex');
	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(signature, 'utf8');
	if (a.length !== b.length || !timingSafeEqual(a, b)) error(401, 'Bad signature');

	type Payload = {
		meta?: { event_name?: string; custom_data?: { user_id?: string } };
		data?: { id?: string; attributes?: { status?: string; customer_id?: number | string; renews_at?: string | null; ends_at?: string | null; user_email?: string } };
	};
	const payload = JSON.parse(raw) as Payload;
	const eventName = payload.meta?.event_name ?? '';
	if (!eventName.startsWith('subscription_')) return json({ ignored: eventName });

	const userId = payload.meta?.custom_data?.user_id;
	const sub = payload.data;
	if (!isUuid(userId) || !sub?.id) error(400, 'Missing user or subscription id');

	const status = sub.attributes?.status ?? '';
	const renews = sub.attributes?.renews_at ?? null;
	const ends = sub.attributes?.ends_at ?? null;
	let ours: 'active' | 'lapsed' | 'cancelled';
	let periodEnd: string | null;
	if (['active', 'on_trial', 'past_due'].includes(status)) {
		ours = 'active';
		periodEnd = renews ?? ends ?? new Date(Date.now() + 366 * 86_400_000).toISOString();
	} else if (status === 'cancelled') {
		ours = 'cancelled'; // keeps perks until ends_at, then behaves like a free account
		periodEnd = ends ?? renews ?? new Date().toISOString();
	} else {
		ours = 'lapsed'; // expired / unpaid / paused
		periodEnd = ends ?? new Date().toISOString();
	}

	const admin = getAdminClient();
	if (!admin) error(503, 'Server not configured');
	const { error: err } = await admin.rpc('apply_subscription_event', {
		p_provider: 'lemonsqueezy',
		p_subscription_id: String(sub.id),
		p_customer_id: sub.attributes?.customer_id != null ? String(sub.attributes.customer_id) : null,
		p_user: userId,
		p_status: ours,
		p_period_end: periodEnd
	});
	if (err) error(500, err.message);
	return json({ ok: true, event: eventName, status: ours });
};
