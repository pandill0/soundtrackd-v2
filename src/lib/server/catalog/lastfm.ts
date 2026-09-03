/** Last.fm charts (non-commercial terms — §6.1). Server-side only; the key never ships to the browser. */
import { serverEnv } from '$lib/server/env';
import { TtlCache } from './cache';

const cache = new TtlCache<unknown>(1000 * 60 * 60 * 6);

async function lfm<T>(method: string, params: Record<string, string | number> = {}): Promise<T | null> {
	if (!serverEnv.lastfmApiKey) return null;
	const qs = new URLSearchParams({ method, api_key: serverEnv.lastfmApiKey, format: 'json', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
	return cache.wrap(qs.toString(), async () => {
		const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`);
		if (!res.ok) return null;
		return (await res.json()) as T;
	}) as Promise<T | null>;
}

export async function chartTopTracks(limit = 25): Promise<{ name: string; artist: string }[]> {
	const r = await lfm<{ tracks?: { track: { name: string; artist: { name: string } }[] } }>('chart.getTopTracks', { limit });
	return r?.tracks?.track?.map((t) => ({ name: t.name, artist: t.artist.name })) ?? [];
}

export async function chartTopArtists(limit = 7): Promise<string[]> {
	const r = await lfm<{ artists?: { artist: { name: string }[] } }>('chart.getTopArtists', { limit });
	return r?.artists?.artist?.map((a) => a.name) ?? [];
}
