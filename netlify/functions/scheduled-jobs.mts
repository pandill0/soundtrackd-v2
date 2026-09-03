/**
 * Netlify scheduled function: pokes the app's job endpoints every hour.
 * The endpoints run in small time-budgeted batches; we loop a few times while work remains.
 * Env needed on Netlify: JOBS_SECRET (same value the app has) — URL is provided by Netlify.
 */
export default async () => {
	const base = (process.env.URL || process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
	const secret = process.env.JOBS_SECRET;
	if (!base || !secret) return new Response('missing URL or JOBS_SECRET', { status: 500 });
	const log: string[] = [];
	for (const job of ['listenbrainz', 'warm-catalog', 'mbid-backfill']) {
		for (let i = 0; i < 3; i++) {
			const res = await fetch(`${base}/api/jobs/${job}`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
			const body = await res.json().catch(() => ({}));
			log.push(`${job}#${i}: ${res.status} ${JSON.stringify(body)}`);
			if (!res.ok || !body.more) break;
		}
	}
	console.log(log.join('\n'));
	return new Response(log.join('\n'));
};

export const config = { schedule: '*/10 * * * *' }; // every 10 minutes (now-playing needs to be fresh)
