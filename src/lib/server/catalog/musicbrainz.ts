/**
 * MusicBrainz — the canonical identity source (CC0). ~1 request/second, descriptive User-Agent
 * required. Only the backfill job calls this; it is never on a page's hot path (§6.1).
 */
import { serverEnv } from '$lib/server/env';
import { config } from '$lib/config';
import { sleep } from './cache';

const BASE = 'https://musicbrainz.org/ws/2';
let lastCall = 0;

async function mb<T>(path: string): Promise<T> {
	const wait = 1100 - (Date.now() - lastCall);
	if (wait > 0) await sleep(wait);
	lastCall = Date.now();
	const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}fmt=json`, {
		headers: {
			accept: 'application/json',
			'user-agent': `Soundtrackd/${config.version} (${serverEnv.musicbrainzContact})`
		}
	});
	if (res.status === 503) {
		await sleep(2000);
		return mb<T>(path);
	}
	if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${path}`);
	return (await res.json()) as T;
}

interface MbReleaseGroup {
	id: string;
	title: string;
	score?: number;
	'first-release-date'?: string;
	'primary-type'?: string;
	'artist-credit'?: { name: string; artist: { id: string; name: string } }[];
}
interface MbArtist {
	id: string;
	name: string;
	score?: number;
}

const lucene = (s: string) => s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
const simplify = (s: string) =>
	s
		.toLowerCase()
		.replace(/\(.*?\)|\[.*?\]/g, '')
		.replace(/deluxe|remaster(ed)?|edition|expanded|bonus|anniversary/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/** Best release-group MBID for an album, or null when nothing scores confidently. */
export async function matchAlbum(title: string, artist: string | null): Promise<{ mbid: string; date: string | null } | null> {
	const q = artist
		? `releasegroup:"${lucene(title)}" AND artist:"${lucene(artist)}"`
		: `releasegroup:"${lucene(title)}"`;
	const r = await mb<{ 'release-groups': MbReleaseGroup[] }>(
		`/release-group/?query=${encodeURIComponent(q)}&limit=5`
	);
	const want = simplify(title);
	const wantArtist = artist ? simplify(artist) : null;
	for (const rg of r['release-groups'] ?? []) {
		const got = simplify(rg.title);
		const gotArtist = simplify(rg['artist-credit']?.map((c) => c.name).join(' ') ?? '');
		const titleOk = got === want || (rg.score ?? 0) >= 95;
		const artistOk = !wantArtist || gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist);
		if (titleOk && artistOk && (rg.score ?? 0) >= 85) {
			return { mbid: rg.id, date: rg['first-release-date'] || null };
		}
	}
	return null;
}

export async function matchArtist(name: string): Promise<string | null> {
	const r = await mb<{ artists: MbArtist[] }>(`/artist/?query=${encodeURIComponent(`artist:"${lucene(name)}"`)}&limit=3`);
	const want = simplify(name);
	const hit = (r.artists ?? []).find((a) => simplify(a.name) === want && (a.score ?? 0) >= 90);
	return hit?.id ?? null;
}

/** Cover Art Archive front image for a release group — free, no rate limit (§6.1). */
export const coverArtUrl = (releaseGroupMbid: string, size: 250 | 500 | 1200 = 500) =>
	`https://coverartarchive.org/release-group/${releaseGroupMbid}/front-${size}`;
