import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverEnv } from '$lib/server/env';
import { backfillLegacy, backfillMbids, pollListenBrainz, warmCatalog } from '$lib/server/catalog/jobs';

const JOBS = {
	'mbid-backfill': backfillMbids,
	'warm-catalog': warmCatalog,
	'backfill-v1': backfillLegacy,
	listenbrainz: pollListenBrainz
} as const;

/**
 * POST /api/jobs/<name>  with  Authorization: Bearer $JOBS_SECRET
 * Runs one time-budgeted batch and reports whether more work remains.
 */
export const POST: RequestHandler = async ({ params, request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	if (!serverEnv.jobsSecret || auth !== `Bearer ${serverEnv.jobsSecret}`) error(401, 'Bad job secret');
	const run = JOBS[params.job as keyof typeof JOBS];
	if (!run) error(404, `Unknown job. Known: ${Object.keys(JOBS).join(', ')}`);
	const budgetMs = Math.min(9000, Number(url.searchParams.get('budget')) || 8000);
	try {
		return json(await run(budgetMs));
	} catch (e) {
		error(500, (e as Error).message);
	}
};
