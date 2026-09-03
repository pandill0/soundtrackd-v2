/**
 * The catalogue module (REBUILD-SPEC §6.1). The ONE place that knows which provider answered.
 * Pages call these functions and get catalogue rows keyed by our own ids; they never see a
 * Deezer id, a MusicBrainz call, or a Last.fm key.
 *
 *   MBIDs are identity · provider ids are cached mappings · Deezer is the beta's search+artwork path
 */
import { getAdminClient } from '$lib/supabase/admin';
import type { CatalogItem, CatalogKind } from '$lib/types';
import { TtlCache, mapLimit } from './cache';
import * as dz from './deezer';
import { chartTopTracks } from './lastfm';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './store';
import type { AlbumDetail, ArtistDetail, CatalogItemInput, CatalogRow, CatalogStore, SearchResults, TrackDetail } from './types';

export type { AlbumDetail, ArtistDetail, SearchResults, TrackDetail } from './types';

let store: CatalogStore | null = null;
let warned = false;

export function getStore(): CatalogStore {
	if (store) return store;
	const admin = getAdminClient();
	if (admin) return (store = new SupabaseStore(admin));
	if (!warned) {
		console.warn('[catalog] SUPABASE_SECRET_KEY is not set — using the in-memory catalogue. Browsing works; rating does not.');
		warned = true;
	}
	return (store = new MemoryStore());
}

export const catalogMode = (): 'supabase' | 'memory' => (getAdminClient() ? 'supabase' : 'memory');

// ── helpers ─────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const isStale = (row: CatalogRow, days: number) => Date.now() - new Date(row.fetched_at).getTime() > days * DAY;

function dedupe<T>(items: (T | null | undefined)[], key: (t: T) => string | number): T[] {
	const seen = new Set<string | number>();
	const out: T[] = [];
	for (const it of items) {
		if (!it) continue;
		const k = key(it);
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(it);
	}
	return out;
}

/** Rows leave the module without provider_ids (§4: nothing else reads them). */
function pub(row: CatalogRow): CatalogItem {
	const { provider_ids: _ignored, ...item } = row;
	void _ignored;
	return item;
}
const pubAll = (rows: CatalogRow[]) => rows.map(pub);

const cover = (a: { cover_xl?: string; cover_big?: string; cover_medium?: string; cover_small?: string } | undefined) =>
	a?.cover_xl || a?.cover_big || a?.cover_medium || a?.cover_small || null;

const albumCache = new TtlCache<AlbumDetail>(60 * 60 * 1000);
const artistCache = new TtlCache<ArtistDetail>(6 * 60 * 60 * 1000);

// ── ensure* : provider objects → stored rows (artists → albums → tracks) ─────
async function ensureArtists(artists: dz.DzArtist[]): Promise<Map<number, CatalogRow>> {
	const uniq = dedupe(artists, (a) => a.id);
	const rows = await getStore().upsert(uniq.map(dz.artistInput));
	return new Map(uniq.map((a, i) => [a.id, rows[i]]));
}

async function ensureAlbums(albums: dz.DzAlbum[]): Promise<CatalogRow[]> {
	if (!albums.length) return [];
	const artistRows = await ensureArtists(albums.map((a) => a.artist).filter(Boolean));
	const inputs = await Promise.all(albums.map((a) => dz.albumInput(a, artistRows.get(a.artist?.id)?.id ?? null)));
	return getStore().upsert(inputs);
}

function albumStub(al: NonNullable<dz.DzTrack['album']>, artist: dz.DzArtist | undefined, artistId: string | null): CatalogItemInput {
	return {
		kind: 'album',
		title: al.title,
		artist_name: artist?.name ?? null,
		artist_id: artistId,
		cover_url: cover(al),
		provider_ids: { deezer: String(al.id) }
	};
}

async function ensureTracks(tracks: dz.DzTrack[]): Promise<{ tracks: CatalogRow[]; albums: CatalogRow[] }> {
	if (!tracks.length) return { tracks: [], albums: [] };
	const s = getStore();
	const artistRows = await ensureArtists(tracks.map((t) => t.artist).filter(Boolean));
	const albums = dedupe(tracks.map((t) => t.album), (a) => a.id);
	const albumRows = await s.upsert(
		albums.map((al) => {
			const t = tracks.find((x) => x.album?.id === al.id)!;
			return albumStub(al, t.artist, artistRows.get(t.artist?.id)?.id ?? null);
		})
	);
	const albumByDz = new Map(albums.map((al, i) => [al.id, albumRows[i]]));
	const trackRows = await s.upsert(
		tracks.map((t) =>
			dz.trackInput(t, albumByDz.get(t.album?.id ?? -1)?.id ?? null, artistRows.get(t.artist?.id ?? -1)?.id ?? null, cover(t.album))
		)
	);
	return { tracks: trackRows, albums: albumRows };
}

/** Full album fetch: record, artist and every track. */
async function refreshAlbum(deezerId: string): Promise<CatalogRow> {
	const s = getStore();
	const a = await dz.dzAlbum(deezerId);
	const artistRows = a.artist ? await ensureArtists([a.artist]) : new Map<number, CatalogRow>();
	const artistRow = a.artist ? artistRows.get(a.artist.id) : undefined;
	const [albumRow] = await s.upsert([await dz.albumInput(a, artistRow?.id ?? null)]);
	const list = a.tracks?.data ?? [];
	if (list.length) {
		await s.upsert(
			list.map((t) =>
				dz.trackInput(
					t,
					albumRow.id,
					// compilations: only link the artist when it is the album's artist
					t.artist?.id === a.artist?.id ? (artistRow?.id ?? null) : null,
					albumRow.cover_url
				)
			)
		);
	}
	albumCache.set(albumRow.id, undefined as unknown as AlbumDetail, 0); // invalidate
	return albumRow;
}

// ── public API ──────────────────────────────────────────────────────────────
export async function getItem(id: string): Promise<CatalogItem | null> {
	const row = await getStore().getById(id);
	return row ? pub(row) : null;
}

export async function getItems(ids: string[]): Promise<CatalogItem[]> {
	return pubAll(await getStore().getByIds(ids));
}

export async function getAlbum(id: string): Promise<AlbumDetail | null> {
	const hit = albumCache.get(id);
	if (hit) return hit;
	const s = getStore();
	let album = await s.getById(id);
	if (!album || album.kind !== 'album') return null;
	let tracks = await s.tracksOf(id);
	const deezerId = album.provider_ids.deezer;
	const needsRefresh = deezerId && (tracks.length === 0 || !album.release_date || isStale(album, 30));
	if (needsRefresh) {
		try {
			album = await refreshAlbum(deezerId);
			tracks = await s.tracksOf(album.id);
		} catch (e) {
			if (!dz.isNotFound(e)) console.warn('[catalog] album refresh failed', e);
		}
	}
	const artist = album.artist_id ? await s.getById(album.artist_id) : null;
	const detail: AlbumDetail = { album: pub(album), artist: artist ? pub(artist) : null, tracks: pubAll(tracks) };
	return albumCache.set(id, detail);
}

export async function getArtist(id: string): Promise<ArtistDetail | null> {
	const hit = artistCache.get(id);
	if (hit) return hit;
	const s = getStore();
	let artist = await s.getById(id);
	if (!artist || artist.kind !== 'artist') return null;
	let albums = await s.albumsOf(id);
	let topTracks: CatalogRow[] = [];
	const deezerId = artist.provider_ids.deezer;
	if (deezerId) {
		try {
			const discAge = artist.discography_at ? Date.now() - new Date(artist.discography_at).getTime() : Infinity;
			const refresh = discAge > 30 * DAY;
			const [a, discog, top] = await Promise.all([
				dz.dzArtist(deezerId),
				refresh ? dz.dzArtistAlbums(deezerId, 100) : null,
				dz.dzArtistTop(deezerId, 5)
			]);
			[artist] = await s.upsert([dz.artistInput(a)]);
			if (discog) {
				const inputs = await Promise.all(discog.data.map((al) => dz.albumInput({ ...al, artist: a }, artist!.id)));
				albums = await s.upsert(inputs);
				await s.markDiscography(artist.id);
			}
			topTracks = (await ensureTracks(top.data.map((t) => ({ ...t, artist: t.artist ?? a })))).tracks;
		} catch (e) {
			if (!dz.isNotFound(e)) console.warn('[catalog] artist refresh failed', e);
		}
	}
	albums.sort((x, y) => (y.release_date ?? '').localeCompare(x.release_date ?? ''));
	const detail: ArtistDetail = { artist: pub(artist), albums: pubAll(albums), topTracks: pubAll(topTracks) };
	return artistCache.set(id, detail);
}

export async function getTrack(id: string): Promise<TrackDetail | null> {
	const s = getStore();
	let track = await s.getById(id);
	if (!track || track.kind !== 'track') return null;
	if ((!track.parent_id || !track.duration_ms) && track.provider_ids.deezer) {
		try {
			const t = await dz.dzTrack(track.provider_ids.deezer);
			[track] = (await ensureTracks([t])).tracks;
		} catch (e) {
			if (!dz.isNotFound(e)) console.warn('[catalog] track refresh failed', e);
		}
	}
	const album = track.parent_id ? await s.getById(track.parent_id) : null;
	const artistId = track.artist_id ?? album?.artist_id ?? null;
	const artist = artistId ? await s.getById(artistId) : null;
	return { track: pub(track), album: album ? pub(album) : null, artist: artist ? pub(artist) : null };
}

export async function searchCatalog(q: string, kind: 'all' | CatalogKind = 'all', limit = 20): Promise<SearchResults> {
	const query = q.trim();
	if (!query) return { albums: [], tracks: [], artists: [] };
	const want = (k: CatalogKind) => kind === 'all' || kind === k;
	const safe = async <T>(p: Promise<T> | null) => {
		try {
			return p ? await p : null;
		} catch (e) {
			console.warn('[catalog] search failed', e);
			return null;
		}
	};
	const [al, tr, ar] = await Promise.all([
		safe(want('album') ? dz.dzSearch('album', query, limit) : null),
		safe(want('track') ? dz.dzSearch('track', query, limit) : null),
		safe(want('artist') ? dz.dzSearch('artist', query, Math.min(limit, 12)) : null)
	]);
	const albums = al ? await ensureAlbums(al.data as dz.DzAlbum[]) : [];
	const tracks = tr ? (await ensureTracks(tr.data as dz.DzTrack[])).tracks : [];
	const artists = ar ? [...(await ensureArtists(ar.data as dz.DzArtist[])).values()] : [];
	return { albums: pubAll(albums), tracks: pubAll(tracks), artists: pubAll(artists) };
}

/** v1 links carry Deezer ids (album.html?id=…). Resolve them to catalogue rows, creating on first sight. */
export async function resolveLegacy(kind: CatalogKind, deezerId: string): Promise<CatalogItem | null> {
	if (!/^\d+$/.test(deezerId)) return null;
	const s = getStore();
	const existing = await s.getByProvider(kind, 'deezer', deezerId);
	if (existing) return pub(existing);
	try {
		if (kind === 'album') return pub(await refreshAlbum(deezerId));
		if (kind === 'artist') {
			const a = await dz.dzArtist(deezerId);
			const [row] = await s.upsert([dz.artistInput(a)]);
			return pub(row);
		}
		const t = await dz.dzTrack(deezerId);
		const [row] = (await ensureTracks([t])).tracks;
		return pub(row);
	} catch (e) {
		if (dz.isNotFound(e)) return null;
		throw e;
	}
}

/** Last.fm chart → Deezer lookups → catalogue rows. Cached server-side for 6 hours (§9). */
export async function trendingAlbums(limit = 12): Promise<CatalogItem[]> {
	const s = getStore();
	const key = `trending:${limit}`;
	const cached = await s.cacheGet<string[]>(key);
	if (cached?.length) return pubAll(await s.getByIds(cached)).sort((a, b) => cached.indexOf(a.id) - cached.indexOf(b.id));
	const top = await chartTopTracks(30);
	if (!top.length) return [];
	const found = await mapLimit(top, 4, async (t) => {
		try {
			const r = await dz.dzSearch('track', `${t.artist} ${t.name}`, 1);
			return r.data[0] as dz.DzTrack | undefined;
		} catch {
			return undefined;
		}
	});
	const tracks = dedupe(
		found.filter((t): t is dz.DzTrack => !!t && !!t.album),
		(t) => t.album!.id
	).slice(0, limit);
	const { albums } = await ensureTracks(tracks);
	await s.cacheSet(key, albums.map((a) => a.id), 6 * 60 * 60 * 1000);
	return pubAll(albums);
}

/** Albums already known for an artist — database only, no provider calls (album page sidebar). */
export async function albumsByArtist(artistId: string, exclude?: string, limit = 6): Promise<CatalogItem[]> {
	const rows = await getStore().albumsOf(artistId);
	return pubAll(rows.filter((r) => r.id !== exclude).slice(0, limit));
}

/** Random pool of album covers for the landing-page hero background. */
export async function heroCovers(limit = 72): Promise<string[]> {
	return getStore().coverPool(limit);
}

/** Resolve a (artist, track title) pair to a catalogue track, best effort (ListenBrainz poller). */
export async function findTrack(artist: string, title: string): Promise<CatalogItem | null> {
	try {
		const r = await dz.dzSearch('track', `${artist} ${title}`, 1);
		const t = r.data[0] as dz.DzTrack | undefined;
		if (!t) return null;
		const [row] = (await ensureTracks([t])).tracks;
		return pub(row);
	} catch {
		return null;
	}
}

/** Resolve an artist name to a catalogue artist, best effort. */
export async function findArtist(name: string): Promise<CatalogItem | null> {
	try {
		const r = await dz.dzSearch('artist', name, 3);
		const data = r.data as dz.DzArtist[];
		if (!data.length) return null;
		const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
		const best = data.find((a) => norm(a.name) === norm(name)) ?? data[0];
		const rows = await ensureArtists([best]);
		return pub(rows.get(best.id)!);
	} catch {
		return null;
	}
}

/** Resolve a (title, artist) pair to a catalogue album, best effort. */
export async function findAlbum(title: string, artist: string): Promise<CatalogItem | null> {
	try {
		const r = await dz.dzSearch('album', `${artist} ${title}`, 3);
		const data = r.data as dz.DzAlbum[];
		if (!data.length) return null;
		const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
		const best = data.find((a) => norm(a.title) === norm(title)) ?? data[0];
		const [row] = await ensureAlbums([best]);
		return pub(row);
	} catch {
		return null;
	}
}
