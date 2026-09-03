import type { PageServerLoad } from './$types';

const SORTS = new Set(['added', 'year', 'artist', 'rating']);

export const load: PageServerLoad = async ({ locals, url }) => {
	const sp = url.searchParams;
	const sort = SORTS.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'added';
	const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
	const genre = sp.get('genre') || null;
	const decade = Number(sp.get('decade')) || null;
	const [{ data: rows }, { data: genres }] = await Promise.all([
		locals.supabase.rpc('queue_list', { p_user: null, p_sort: sort, p_dir: dir, p_genre: genre, p_decade: decade }),
		locals.supabase.rpc('rated_genres', { p_limit: 30 })
	]);
	type Row = { catalog_item_id: string; note: string | null; added_at: string; title: string; artist_name: string | null; artist_id: string | null; cover_url: string | null; release_year: number | null; genres: string[]; rating_count: number; avg_rating: number | null };
	const items = (rows as Row[] | null) ?? [];
	const decades = [...new Set(items.map((i) => i.release_year).filter((y): y is number => !!y).map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
	return {
		items,
		genres: ((genres as { genre: string }[] | null) ?? []).map((g) => g.genre),
		decades,
		queuePublic: !!(locals.profile as { queue_public?: boolean } | null)?.queue_public
	};
};
