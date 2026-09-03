import type { CatalogItem, CatalogKind } from '$lib/types';

/** A stored row. provider_ids never leaves this module (§4). */
export interface CatalogRow extends CatalogItem {
	provider_ids: Record<string, string>;
}

/** What the providers hand to the store. Unknown fields are simply left unset. */
export interface CatalogItemInput {
	kind: CatalogKind;
	title: string;
	artist_name?: string | null;
	artist_id?: string | null;
	parent_id?: string | null;
	release_date?: string | null;
	genres?: string[];
	cover_url?: string | null;
	provider_ids: Record<string, string>;
	record_type?: string | null;
	duration_ms?: number | null;
	position?: number | null;
	label?: string | null;
	track_count?: number | null;
	mbid?: string | null;
}

export interface CatalogStore {
	getById(id: string): Promise<CatalogRow | null>;
	getByIds(ids: string[]): Promise<CatalogRow[]>;
	getByProvider(kind: CatalogKind, provider: string, providerId: string): Promise<CatalogRow | null>;
	tracksOf(albumId: string): Promise<CatalogRow[]>;
	albumsOf(artistId: string): Promise<CatalogRow[]>;
	/** Returns rows in input order. */
	upsert(items: CatalogItemInput[]): Promise<CatalogRow[]>;
	unmatched(kind: CatalogKind, limit: number): Promise<CatalogRow[]>;
	/** mbid null = looked and found nothing confident (stamps mbid_checked_at). */
	setMbid(id: string, mbid: string | null, cover?: string | null): Promise<void>;
	markDiscography(artistId: string): Promise<void>;
	coverPool(limit: number): Promise<string[]>;
	cacheGet<T>(key: string): Promise<T | null>;
	cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

export interface AlbumDetail {
	album: CatalogItem;
	artist: CatalogItem | null;
	tracks: CatalogItem[];
}
export interface ArtistDetail {
	artist: CatalogItem;
	albums: CatalogItem[];
	topTracks: CatalogItem[];
}
export interface TrackDetail {
	track: CatalogItem;
	album: CatalogItem | null;
	artist: CatalogItem | null;
}
export interface SearchResults {
	albums: CatalogItem[];
	tracks: CatalogItem[];
	artists: CatalogItem[];
}
