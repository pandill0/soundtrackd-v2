/** lyrics.ovh — free, keyless, frequently 404s (§6). Cached; failures are just "no lyrics". */
import { TtlCache } from './catalog/cache';

const cache = new TtlCache<string | null>(1000 * 60 * 60 * 24);

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
	const key = `${artist}::${title}`.toLowerCase();
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	try {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 4500);
		const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, {
			signal: ctrl.signal
		});
		clearTimeout(t);
		if (!res.ok) return cache.set(key, null);
		const json = (await res.json()) as { lyrics?: string };
		const text = json.lyrics?.trim() || null;
		return cache.set(key, text);
	} catch {
		return cache.set(key, null, 1000 * 60 * 10);
	}
}
