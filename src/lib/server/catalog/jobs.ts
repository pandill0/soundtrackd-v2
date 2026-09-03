/**
 * Background jobs (§7). Each runs inside a time budget because they execute in a serverless
 * function; the caller (netlify/functions/scheduled-jobs.mts) loops while `more` is true.
 */
import { getAdminClient } from '$lib/supabase/admin';
import { HERO_ALBUMS } from './curated';
import { getStore, findAlbum, resolveLegacy } from './index';
import { matchAlbum, matchArtist } from './musicbrainz';

export interface JobResult {
	job: string;
	processed: number;
	changed: number;
	more: boolean;
	notes?: string[];
}

const budget = (ms: number) => {
	const end = Date.now() + ms;
	return () => Date.now() < end;
};

/** Match unmatched catalogue rows against MusicBrainz, ~1 req/s (§6.1). */
export async function backfillMbids(budgetMs = 8000): Promise<JobResult> {
	const s = getStore();
	const hasTime = budget(budgetMs);
	let processed = 0;
	let changed = 0;
	const notes: string[] = [];
	const albums = await s.unmatched('album', 20);
	for (const row of albums) {
		if (!hasTime()) break;
		processed++;
		try {
			const m = await matchAlbum(row.title, row.artist_name);
			await s.setMbid(row.id, m?.mbid ?? null);
			if (m) changed++;
		} catch (e) {
			notes.push(`${row.title}: ${(e as Error).message}`);
		}
	}
	const artists = hasTime() ? await s.unmatched('artist', 10) : [];
	for (const row of artists) {
		if (!hasTime()) break;
		processed++;
		try {
			const mbid = await matchArtist(row.title);
			await s.setMbid(row.id, mbid);
			if (mbid) changed++;
		} catch (e) {
			notes.push(`${row.title}: ${(e as Error).message}`);
		}
	}
	return { job: 'mbid-backfill', processed, changed, more: albums.length + artists.length > processed, notes };
}

/** Resolve the curated hero list into catalogue rows, resuming where the last run stopped. */
export async function warmCatalog(budgetMs = 8000): Promise<JobResult> {
	const s = getStore();
	const hasTime = budget(budgetMs);
	const start = (await s.cacheGet<number>('warm:cursor')) ?? 0;
	let i = start;
	let changed = 0;
	while (i < HERO_ALBUMS.length && hasTime()) {
		const { title, artist } = HERO_ALBUMS[i];
		if (await findAlbum(title, artist)) changed++;
		i++;
	}
	const done = i >= HERO_ALBUMS.length;
	await s.cacheSet('warm:cursor', done ? 0 : i, 30 * 86_400_000);
	if (done) await s.cacheSet('warm:done_at', Date.now(), 30 * 86_400_000);
	return { job: 'warm-catalog', processed: i - start, changed, more: !done };
}

/**
 * Migrate v1 data onto the catalogue: ratings keyed by Deezer ids get catalog_item_id, track
 * ratings get album_item_id (§11 #4), and list items / favourites saved with Spotify ids
 * (§11 #1) are re-resolved by title + artist.
 */
export async function backfillLegacy(budgetMs = 8000): Promise<JobResult> {
	const admin = getAdminClient();
	if (!admin) throw new Error('SUPABASE_SECRET_KEY required');
	const hasTime = budget(budgetMs);
	let processed = 0;
	let changed = 0;
	const notes: string[] = [];

	// 1. album ratings
	const { data: ratingIds } = await admin
		.from('ratings')
		.select('album_id')
		.is('catalog_item_id', null)
		.not('album_id', 'is', null)
		.limit(200);
	for (const deezerId of new Set((ratingIds ?? []).map((r) => r.album_id as string))) {
		if (!hasTime()) return { job: 'backfill-v1', processed, changed, more: true, notes };
		processed++;
		const item = await resolveLegacy('album', deezerId);
		if (!item) {
			notes.push(`album ${deezerId}: not found on Deezer`);
			continue;
		}
		const { count } = await admin
			.from('ratings')
			.update({ catalog_item_id: item.id }, { count: 'exact' })
			.eq('album_id', deezerId)
			.is('catalog_item_id', null);
		changed += count ?? 0;
	}

	// 2. track ratings
	const { data: trackIds } = await admin
		.from('track_ratings')
		.select('track_id')
		.is('catalog_item_id', null)
		.not('track_id', 'is', null)
		.limit(300);
	for (const deezerId of new Set((trackIds ?? []).map((r) => r.track_id as string))) {
		if (!hasTime()) return { job: 'backfill-v1', processed, changed, more: true, notes };
		processed++;
		const item = await resolveLegacy('track', deezerId);
		if (!item) {
			notes.push(`track ${deezerId}: not found on Deezer`);
			continue;
		}
		const { count } = await admin
			.from('track_ratings')
			.update({ catalog_item_id: item.id, album_item_id: item.parent_id }, { count: 'exact' })
			.eq('track_id', deezerId)
			.is('catalog_item_id', null);
		changed += count ?? 0;
	}

	// 3. list items and favourite albums without a catalogId
	const { data: lists } = await admin.from('lists').select('id, items');
	for (const list of lists ?? []) {
		const items = (list.items as Record<string, unknown>[]) ?? [];
		if (items.every((it) => it.catalogId)) continue;
		if (!hasTime()) return { job: 'backfill-v1', processed, changed, more: true, notes };
		let touched = false;
		for (const it of items) {
			if (it.catalogId || it.type !== 'album') continue;
			processed++;
			const found = await findAlbum(String(it.title ?? ''), String(it.artist ?? ''));
			if (found) {
				it.catalogId = found.id;
				it.cover = found.cover_url ?? it.cover;
				touched = true;
				changed++;
			}
		}
		if (touched) await admin.from('lists').update({ items }).eq('id', list.id);
	}

	const { data: profiles } = await admin.from('profiles').select('id, favorite_albums').not('favorite_albums', 'is', null);
	for (const p of profiles ?? []) {
		const favs = (p.favorite_albums as (Record<string, unknown> | null)[]) ?? [];
		if (favs.every((f) => !f || f.catalogId)) continue;
		if (!hasTime()) return { job: 'backfill-v1', processed, changed, more: true, notes };
		let touched = false;
		for (const f of favs) {
			if (!f || f.catalogId) continue;
			processed++;
			const found = await findAlbum(String(f.name ?? ''), String(f.artist ?? ''));
			if (found) {
				f.catalogId = found.id;
				f.cover = found.cover_url ?? f.cover;
				touched = true;
				changed++;
			}
		}
		if (touched) await admin.from('profiles').update({ favorite_albums: favs }).eq('id', p.id);
	}

	return { job: 'backfill-v1', processed, changed, more: false, notes };
}
