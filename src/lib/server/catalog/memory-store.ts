/**
 * In-memory catalogue store. Used automatically when SUPABASE_SECRET_KEY is not set, so the
 * site can be browsed locally before secrets exist. Ratings and queues need real rows and
 * will not work in this mode — the pages say so.
 */
import { createHash } from 'node:crypto';
import type { CatalogKind } from '$lib/types';
import type { CatalogRow, CatalogStore, CatalogItemInput } from './types';

/** Deterministic UUID (v5-shaped) so dev links stay stable across restarts. */
export function uuidFrom(seed: string): string {
	const h = createHash('sha1').update(seed).digest('hex');
	const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

export class MemoryStore implements CatalogStore {
	private rows = new Map<string, CatalogRow>();
	private cache = new Map<string, { value: unknown; exp: number }>();

	async getById(id: string) {
		return this.rows.get(id) ?? null;
	}
	async getByIds(ids: string[]) {
		return ids.map((i) => this.rows.get(i)).filter((r): r is CatalogRow => !!r);
	}
	async getByProvider(kind: CatalogKind, provider: string, providerId: string) {
		for (const r of this.rows.values()) if (r.kind === kind && r.provider_ids[provider] === providerId) return r;
		return null;
	}
	async tracksOf(albumId: string) {
		return [...this.rows.values()]
			.filter((r) => r.kind === 'track' && r.parent_id === albumId)
			.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
	}
	async albumsOf(artistId: string) {
		return [...this.rows.values()]
			.filter((r) => r.kind === 'album' && r.artist_id === artistId)
			.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
	}
	async upsert(items: CatalogItemInput[]) {
		return items.map((it) => {
			const dz = it.provider_ids?.deezer;
			let existing = it.mbid ? [...this.rows.values()].find((r) => r.mbid === it.mbid) : undefined;
			if (!existing && dz) existing = [...this.rows.values()].find((r) => r.kind === it.kind && r.provider_ids.deezer === dz);
			const id = existing?.id ?? uuidFrom(`${it.kind}:${it.mbid ?? (dz ? 'deezer:' + dz : String(Math.random()))}`);
			const year = it.release_date ? Number(it.release_date.slice(0, 4)) : (existing?.release_year ?? null);
			const row: CatalogRow = {
				id,
				mbid: existing?.mbid ?? it.mbid ?? null,
				kind: it.kind,
				title: it.title || existing?.title || 'Untitled',
				artist_name: it.artist_name ?? existing?.artist_name ?? null,
				artist_id: it.artist_id ?? existing?.artist_id ?? null,
				parent_id: it.parent_id ?? existing?.parent_id ?? null,
				release_date: it.release_date ?? existing?.release_date ?? null,
				release_year: Number.isFinite(year) ? year : null,
				genres: it.genres?.length ? it.genres : (existing?.genres ?? []),
				cover_url: it.cover_url ?? existing?.cover_url ?? null,
				provider_ids: { ...(existing?.provider_ids ?? {}), ...(it.provider_ids ?? {}) },
				record_type: it.record_type ?? existing?.record_type ?? null,
				duration_ms: it.duration_ms ?? existing?.duration_ms ?? null,
				position: it.position ?? existing?.position ?? null,
				label: it.label ?? existing?.label ?? null,
				track_count: it.track_count ?? existing?.track_count ?? null,
				fetched_at: new Date().toISOString(),
				discography_at: existing?.discography_at ?? null
			};
			this.rows.set(id, row);
			return row;
		});
	}
	async unmatched(kind: CatalogKind, limit: number) {
		return [...this.rows.values()].filter((r) => r.kind === kind && !r.mbid).slice(0, limit);
	}
	async setMbid(id: string, mbid: string | null, cover: string | null = null) {
		const r = this.rows.get(id);
		if (r) {
			if (mbid) r.mbid = mbid;
			if (cover) r.cover_url = cover;
		}
	}
	async markDiscography(artistId: string) {
		const r = this.rows.get(artistId);
		if (r) r.discography_at = new Date().toISOString();
	}
	async coverPool(limit: number) {
		return [...this.rows.values()]
			.filter((r) => r.kind === 'album' && r.cover_url)
			.map((r) => r.cover_url as string)
			.sort(() => Math.random() - 0.5)
			.slice(0, limit);
	}
	async cacheGet<T>(key: string) {
		const hit = this.cache.get(key);
		if (!hit || hit.exp < Date.now()) return null;
		return hit.value as T;
	}
	async cacheSet<T>(key: string, value: T, ttlMs: number) {
		this.cache.set(key, { value, exp: Date.now() + ttlMs });
	}
}
