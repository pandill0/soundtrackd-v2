import type { PageServerLoad } from './$types';

const SORTS = new Set(['joined', 'reviews', 'username', 'active']);

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = url.searchParams.get('q')?.trim() || null;
	const sort = SORTS.has(url.searchParams.get('sort') ?? '') ? url.searchParams.get('sort')! : 'joined';
	const { data } = await locals.supabase.rpc('members_directory', { p_q: q, p_sort: sort, p_limit: 100, p_offset: 0 });
	let mine: string[] = [];
	let theirs: string[] = [];
	if (locals.user) {
		const [a, b] = await Promise.all([
			locals.supabase.from('follows').select('following_id').eq('follower_id', locals.user.id),
			locals.supabase.from('follows').select('follower_id').eq('following_id', locals.user.id)
		]);
		mine = (a.data ?? []).map((r) => r.following_id as string);
		theirs = (b.data ?? []).map((r) => r.follower_id as string);
	}
	return { q: q ?? '', members: (data as Record<string, unknown>[] | null) ?? [], mine, theirs };
};
