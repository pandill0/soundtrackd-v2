/** Small formatting helpers shared across pages. */

export function timeAgo(input: string | Date | null | undefined): string {
	if (!input) return '';
	const d = typeof input === 'string' ? new Date(input) : input;
	const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
	if (s < 45) return 'just now';
	if (s < 3600) return `${Math.round(s / 60)}m ago`;
	if (s < 86400) return `${Math.round(s / 3600)}h ago`;
	if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
	return d.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
	});
}

export function formatDate(input: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
	if (!input) return '';
	const d = new Date(input.length === 10 ? input + 'T00:00:00' : input);
	if (Number.isNaN(d.getTime())) return input;
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', ...opts });
}

/** 225000 → "3:45" */
export function formatDuration(ms: number | null | undefined): string {
	if (!ms) return '';
	const total = Math.round(ms / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

/** 2880000 → "48 min", 4500000 → "1 hr 15 min" */
export function formatRuntime(ms: number | null | undefined): string {
	if (!ms) return '';
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `${mins} min`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function plural(n: number, word: string, pluralWord = word + 's'): string {
	return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

export function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Deterministic hue from a string — used for avatar placeholders. */
export function hashHue(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h % 360;
}

export function decadeOf(year: number | null | undefined): string {
	if (!year) return '';
	return `${Math.floor(year / 10) * 10}s`;
}

/** Album/track pages use catalogue UUIDs in URLs (§4). */
export const isUuid = (s: string | null | undefined): s is string =>
	!!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function albumHref(id: string) {
	return `/album/${id}`;
}
export function trackHref(id: string) {
	return `/song/${id}`;
}
export function artistHref(id: string) {
	return `/artist/${id}`;
}
export function profileHref(username: string) {
	return `/profile/${encodeURIComponent(username)}`;
}
