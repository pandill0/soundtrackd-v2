import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isSupporter } from '$lib/entitlements';
import type { FavoriteAlbum, FavoriteArtist } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.profile) redirect(303, '/login?next=/settings');
	return {
		profile: locals.profile,
		email: locals.user.email ?? '',
		tab: url.searchParams.get('tab') ?? 'profile',
		supporter: isSupporter(locals.profile),
		hasPassword: (locals.user.identities ?? []).some((i) => i.provider === 'email')
	};
};

const str = (form: FormData, key: string, max = 200) => String(form.get(key) ?? '').trim().slice(0, max);

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await request.formData();
		const website = str(form, 'website', 200);
		if (website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(website)) {
			return fail(400, { tab: 'profile', error: 'That website address does not look right.' });
		}
		const avatar = str(form, 'avatar_url', 500);
		if (avatar && !/^https?:\/\//i.test(avatar)) return fail(400, { tab: 'profile', error: 'Avatar must be an https:// image URL.' });
		const accent = str(form, 'accent_color', 7);
		const update: Record<string, unknown> = {
			bio: str(form, 'bio', 1000) || null,
			pronouns: str(form, 'pronouns', 40) || null,
			website: website || null,
			avatar_url: avatar || null,
			listenbrainz_user: str(form, 'listenbrainz_user', 64) || null,
			queue_public: form.get('queue_public') === 'on'
		};
		if (isSupporter(locals.profile)) update.accent_color = /^#[0-9a-f]{6}$/i.test(accent) ? accent : null;
		const { error } = await locals.supabase.from('profiles').update(update).eq('id', locals.user.id);
		if (error) return fail(400, { tab: 'profile', error: error.message });
		return { tab: 'profile', success: 'Profile saved.' };
	},

	status: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await request.formData();
		const hours = Number(form.get('expires'));
		const { error } = await locals.supabase
			.from('profiles')
			.update({
				status_text: str(form, 'status_text', 140) || null,
				status_emoji: str(form, 'status_emoji', 8) || null,
				status_updated_at: new Date().toISOString(),
				status_expires_at: hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null
			})
			.eq('id', locals.user.id);
		if (error) return fail(400, { tab: 'status', error: error.message });
		return { tab: 'status', success: 'Status updated.' };
	},

	favorites: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await request.formData();
		const parse = <T>(key: string): (T | null)[] => {
			try {
				const arr = JSON.parse(String(form.get(key) ?? '[]'));
				return Array.isArray(arr) ? arr.slice(0, 4) : [];
			} catch {
				return [];
			}
		};
		const albums = parse<FavoriteAlbum>('favorite_albums').map((a) =>
			a && typeof a === 'object' ? { id: String(a.id ?? ''), catalogId: a.catalogId ?? null, name: String(a.name ?? '').slice(0, 200), artist: String(a.artist ?? '').slice(0, 200), cover: String(a.cover ?? '').slice(0, 500) } : null
		);
		const artists = parse<FavoriteArtist>('favorite_artists').map((a) =>
			a && typeof a === 'object' ? { id: String(a.id ?? ''), catalogId: a.catalogId ?? null, name: String(a.name ?? '').slice(0, 200), picture: String(a.picture ?? '').slice(0, 500) } : null
		);
		const { error } = await locals.supabase.from('profiles').update({ favorite_albums: albums, favorite_artists: artists }).eq('id', locals.user.id);
		if (error) return fail(400, { tab: 'favorites', error: error.message });
		return { tab: 'favorites', success: 'Favourites saved.' };
	},

	password: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		if (password.length < 8) return fail(400, { tab: 'password', error: 'Use at least 8 characters.' });
		if (password !== String(form.get('confirm') ?? '')) return fail(400, { tab: 'password', error: 'Passwords do not match.' });
		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { tab: 'password', error: error.message });
		return { tab: 'password', success: 'Password updated.' };
	}
};
