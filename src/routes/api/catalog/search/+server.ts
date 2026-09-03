import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchCatalog } from '$lib/server/catalog';
import type { CatalogKind } from '$lib/types';

/** GET /api/catalog/search?q=…&kind=all|album|track|artist&limit=20 — used by pickers. */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const kindParam = url.searchParams.get('kind') ?? 'all';
	const kind = (['all', 'album', 'track', 'artist'].includes(kindParam) ? kindParam : 'all') as 'all' | CatalogKind;
	const limit = Math.min(40, Math.max(1, Number(url.searchParams.get('limit')) || 12));
	if (q.length < 2) return json({ albums: [], tracks: [], artists: [] });
	const results = await searchCatalog(q, kind, limit);
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600' });
	return json(results);
};
