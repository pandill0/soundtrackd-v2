/**
 * Deezer: the beta's search-and-artwork path (§6.1). Called server-side, so no CORS proxy
 * is needed and the Cloudflare worker is retired. Non-commercial terms — see §6.1.
 * Nothing outside src/lib/server/catalog imports this file.
 */
import { TtlCache } from './cache';
import type { CatalogItemInput } from './types';

const BASE = 'https://api.deezer.com';
const cache = new TtlCache<unknown>(1000 * 60 * 30, 2000);

export interface DzArtist {
	id: number;
	name: string;
	picture_small?: string;
	picture_medium?: string;
	picture_big?: string;
	picture_xl?: string;
	nb_album?: number;
	nb_fan?: number;
}
export interface DzTrack {
	id: number;
	title: string;
	title_short?: string;
	duration: number;
	track_position?: number;
	disk_number?: number;
	artist: { id: number; name: string };
	album?: { id: number; title: string; cover_small?: string; cover_medium?: string; cover_big?: string; cover_xl?: string };
}
export interface DzAlbum {
	id: number;
	title: string;
	cover_small?: string;
	cover_medium?: string;
	cover_big?: string;
	cover_xl?: string;
	genre_id?: number;
	genres?: { data: { id: number; name: string }[] };
	label?: string;
	nb_tracks?: number;
	duration?: number;
	release_date?: string;
	record_type?: string;
	artist: DzArtist;
	tracks?: { data: DzTrack[] };
}

class DeezerError extends Error {
	constructor(
		message: string,
		public code?: number
	) {
		super(message);
	}
}

async function dz<T>(path: string, ttlMs?: number): Promise<T> {
	return cache.wrap(
		path,
		async () => {
			const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
			if (!res.ok) throw new DeezerError(`Deezer ${res.status} for ${path}`, res.status);
			const json = (await res.json()) as T & { error?: { code: number; message: string } };
			if (json && typeof json === 'object' && 'error' in json && json.error) {
				throw new DeezerError(json.error.message || 'Deezer error', json.error.code);
			}
			return json;
		},
		ttlMs
	) as Promise<T>;
}

export const isNotFound = (e: unknown) =>
	e instanceof DeezerError && (e.code === 800 || e.code === 404 || /no data/i.test(e.message));

export const dzAlbum = (id: string) => dz<DzAlbum>(`/album/${encodeURIComponent(id)}`, 1000 * 60 * 60 * 6);
export const dzArtist = (id: string) => dz<DzArtist>(`/artist/${encodeURIComponent(id)}`, 1000 * 60 * 60 * 6);
export const dzArtistAlbums = (id: string, limit = 100) =>
	dz<{ data: DzAlbum[] }>(`/artist/${encodeURIComponent(id)}/albums?limit=${limit}`, 1000 * 60 * 60 * 6);
export const dzArtistTop = (id: string, limit = 5) =>
	dz<{ data: DzTrack[] }>(`/artist/${encodeURIComponent(id)}/top?limit=${limit}`, 1000 * 60 * 60 * 6);
export const dzTrack = (id: string) => dz<DzTrack>(`/track/${encodeURIComponent(id)}`, 1000 * 60 * 60 * 6);
export const dzSearch = (kind: 'album' | 'track' | 'artist', q: string, limit = 20) =>
	dz<{ data: (DzAlbum | DzTrack | DzArtist)[] }>(
		`/search/${kind}?q=${encodeURIComponent(q)}&limit=${limit}`,
		1000 * 60 * 10
	);

let genreMap: Promise<Map<number, string>> | null = null;
/** Deezer search results only carry genre_id; the names come from the (tiny, static) genre list. */
export function dzGenreName(id: number | undefined): Promise<string | null> {
	if (!id || id === 0) return Promise.resolve(null);
	genreMap ??= dz<{ data: { id: number; name: string }[] }>('/genre', 1000 * 60 * 60 * 24)
		.then((r) => new Map(r.data.map((g) => [g.id, g.name])))
		.catch(() => new Map());
	return genreMap.then((m) => m.get(id) ?? null);
}

// ── Mapping to catalogue inputs ─────────────────────────────────────────────
const cover = (a: { cover_xl?: string; cover_big?: string; cover_medium?: string; cover_small?: string } | undefined) =>
	a?.cover_xl || a?.cover_big || a?.cover_medium || a?.cover_small || null;
const picture = (a: DzArtist | undefined) =>
	a?.picture_xl || a?.picture_big || a?.picture_medium || a?.picture_small || null;
const norm = (g: string) => g.trim().toLowerCase();

export function artistInput(a: DzArtist): CatalogItemInput {
	return { kind: 'artist', title: a.name, cover_url: picture(a), provider_ids: { deezer: String(a.id) } };
}

export async function albumInput(a: DzAlbum, artistCatalogId: string | null): Promise<CatalogItemInput> {
	const genres = a.genres?.data?.map((g) => norm(g.name)) ?? [];
	if (!genres.length) {
		const g = await dzGenreName(a.genre_id);
		if (g) genres.push(norm(g));
	}
	return {
		kind: 'album',
		title: a.title,
		artist_name: a.artist?.name ?? null,
		artist_id: artistCatalogId,
		release_date: a.release_date && a.release_date !== '0000-00-00' ? a.release_date : null,
		genres,
		cover_url: cover(a),
		provider_ids: { deezer: String(a.id) },
		record_type: a.record_type ?? null,
		label: a.label ?? null,
		track_count: a.nb_tracks ?? null,
		duration_ms: a.duration ? a.duration * 1000 : null
	};
}

export function trackInput(
	t: DzTrack,
	albumCatalogId: string | null,
	artistCatalogId: string | null,
	coverUrl: string | null
): CatalogItemInput {
	return {
		kind: 'track',
		title: t.title,
		artist_name: t.artist?.name ?? null,
		artist_id: artistCatalogId,
		parent_id: albumCatalogId,
		position: t.track_position ?? null,
		duration_ms: t.duration ? t.duration * 1000 : null,
		cover_url: coverUrl ?? cover(t.album),
		provider_ids: { deezer: String(t.id) }
	};
}
