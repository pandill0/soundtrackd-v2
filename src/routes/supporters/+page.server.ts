import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase.from('supporters_public').select('*');
	return { supporters: (data as { id: string; username: string; avatar_url: string | null; accent_color: string | null; supporter_since: string | null }[] | null) ?? [] };
};
