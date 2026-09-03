/** Tiny in-memory TTL cache. Lives for the life of the server process (a warm Netlify function). */
export class TtlCache<V> {
	private map = new Map<string, { v: V; exp: number }>();
	constructor(private ttlMs: number, private max = 500) {}

	get(key: string): V | undefined {
		const hit = this.map.get(key);
		if (!hit) return undefined;
		if (hit.exp < Date.now()) {
			this.map.delete(key);
			return undefined;
		}
		return hit.v;
	}

	set(key: string, v: V, ttlMs = this.ttlMs): V {
		if (this.map.size >= this.max) {
			const first = this.map.keys().next().value;
			if (first !== undefined) this.map.delete(first);
		}
		this.map.set(key, { v, exp: Date.now() + ttlMs });
		return v;
	}

	async wrap(key: string, fn: () => Promise<V>, ttlMs = this.ttlMs): Promise<V> {
		const hit = this.get(key);
		if (hit !== undefined) return hit;
		return this.set(key, await fn(), ttlMs);
	}
}

/** Runs async tasks with limited concurrency (Deezer allows ~50 req / 5 s per IP — §11 bug #8). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i], i);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
