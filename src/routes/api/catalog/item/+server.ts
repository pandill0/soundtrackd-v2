import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem } from '$lib/server/catalog';
import { isUuid } from '$lib/utils';

/** GET /api/catalog/item?id=… → one catalogue row (used when a shared record arrives over realtime). */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!isUuid(id)) error(400, 'Bad id');
	const item = await getItem(id);
	if (!item) error(404, 'Not found');
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return json(item);
};
