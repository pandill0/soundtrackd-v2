import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveLegacy } from '$lib/server/catalog';
import { isUuid } from '$lib/utils';

/**
 * v1 URLs → v2 URLs. Album/song/artist links carried Deezer ids; those are resolved through
 * the catalogue module (creating the row on first sight). Profile links carried user uuids.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const page = params.page.replace(/\.html$/, '');
	const id = url.searchParams.get('id') ?? '';
	const user = url.searchParams.get('user') ?? '';

	const usernameFor = async (uuid: string) => {
		if (!isUuid(uuid)) return null;
		const { data } = await locals.supabase.from('profiles').select('username').eq('id', uuid).maybeSingle();
		return data?.username ?? null;
	};

	switch (page) {
		case 'index':
			redirect(301, '/');
		case 'dash':
			redirect(301, '/dash');
		case 'login':
			redirect(301, '/login');
		case 'search':
			redirect(301, `/search${url.search}`);
		case 'lists':
			redirect(301, '/lists');
		case 'charts':
			redirect(301, '/charts');
		case 'members':
			redirect(301, '/members');
		case 'list':
			redirect(301, isUuid(id) ? `/list/${id}` : '/lists');
		case 'profile': {
			if (!user) redirect(301, locals.profile ? `/profile/${encodeURIComponent(locals.profile.username)}` : '/members');
			const name = await usernameFor(user);
			redirect(301, name ? `/profile/${encodeURIComponent(name)}` : '/members');
		}
		case 'followers': {
			const name = user ? await usernameFor(user) : locals.profile?.username;
			const tab = url.searchParams.get('tab') === 'following' ? 'following' : 'followers';
			redirect(301, name ? `/profile/${encodeURIComponent(name)}/${tab}` : '/members');
		}
		case 'album':
		case 'song':
		case 'artist': {
			const kind = page === 'song' ? 'track' : page;
			const item = await resolveLegacy(kind, id);
			if (!item) error(404, `That ${page} is no longer available.`);
			redirect(301, `/${page}/${item.id}`);
		}
	}
	error(404, 'Not found');
};
