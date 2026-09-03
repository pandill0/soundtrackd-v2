/** Supabase-backed catalogue store. Writes go through the service-role RPCs (§4). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogKind } from '$lib/types';
import type { CatalogRow, CatalogStore, CatalogItemInput } from './types';

export class SupabaseStore implements CatalogStore {
	constructor(private db: SupabaseClient) {}

	async getById(id: string) {
		const { data } = await this.db.from('catalog_items').select('*').eq('id', id).maybeSingle();
		return (data as CatalogRow | null) ?? null;
	}
	async getByIds(ids: string[]) {
		if (!ids.length) return [];
		const { data } = await this.db.from('catalog_items').select('*').in('id', ids);
		return (data as CatalogRow[]) ?? [];
	}
	async getByProvider(kind: CatalogKind, provider: string, providerId: string) {
		const { data } = await this.db
			.from('catalog_items')
			.select('*')
			.eq('kind', kind)
			.contains('provider_ids', { [provider]: providerId })
			.limit(1)
			.maybeSingle();
		return (data as CatalogRow | null) ?? null;
	}
	async tracksOf(albumId: string) {
		const { data } = await this.db
			.from('catalog_items')
			.select('*')
			.eq('kind', 'track')
			.eq('parent_id', albumId)
			.order('position', { ascending: true, nullsFirst: false });
		return (data as CatalogRow[]) ?? [];
	}
	async albumsOf(artistId: string) {
		const { data } = await this.db
			.from('catalog_items')
			.select('*')
			.eq('kind', 'album')
			.eq('artist_id', artistId)
			.order('release_date', { ascending: false, nullsFirst: false });
		return (data as CatalogRow[]) ?? [];
	}
	async upsert(items: CatalogItemInput[]) {
		if (!items.length) return [];
		const { data, error } = await this.db.rpc('catalog_upsert_items', { p_items: items });
		if (error) throw new Error(`catalog_upsert_items: ${error.message}`);
		return (data as CatalogRow[]) ?? [];
	}
	async unmatched(kind: CatalogKind, limit: number) {
		const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
		const { data } = await this.db
			.from('catalog_items')
			.select('*')
			.eq('kind', kind)
			.is('mbid', null)
			.or(`mbid_checked_at.is.null,mbid_checked_at.lt.${cutoff}`)
			.order('mbid_checked_at', { ascending: true, nullsFirst: true })
			.order('created_at', { ascending: true })
			.limit(limit);
		return (data as CatalogRow[]) ?? [];
	}
	async setMbid(id: string, mbid: string | null, cover: string | null = null) {
		const { error } = await this.db.rpc('catalog_set_mbid', { p_id: id, p_mbid: mbid, p_cover: cover });
		if (error) throw new Error(`catalog_set_mbid: ${error.message}`);
	}
	async coverPool(limit: number) {
		const { data } = await this.db
			.from('catalog_items')
			.select('cover_url')
			.eq('kind', 'album')
			.not('cover_url', 'is', null)
			.order('fetched_at', { ascending: false })
			.limit(Math.max(limit * 3, 60));
		const urls = ((data as { cover_url: string }[]) ?? []).map((r) => r.cover_url);
		return shuffle(urls).slice(0, limit);
	}
	async cacheGet<T>(key: string) {
		const { data } = await this.db
			.from('app_cache')
			.select('value, expires_at')
			.eq('key', key)
			.gt('expires_at', new Date().toISOString())
			.maybeSingle();
		return (data?.value as T) ?? null;
	}
	async cacheSet<T>(key: string, value: T, ttlMs: number) {
		await this.db.from('app_cache').upsert({
			key,
			value,
			expires_at: new Date(Date.now() + ttlMs).toISOString(),
			updated_at: new Date().toISOString()
		});
	}
}

function shuffle<T>(arr: T[]): T[] {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
