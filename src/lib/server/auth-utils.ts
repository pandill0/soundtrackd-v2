import { config } from '$lib/config';

/** Only allow same-site relative redirects after auth. */
export function safeNext(next: string | null | undefined, fallback = '/dash'): string {
	if (!next) return fallback;
	if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/auth') || next === '/login') return fallback;
	return next;
}

export function validateUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
	const username = raw.trim();
	if (!config.username.pattern.test(username)) {
		return { ok: false, error: 'Usernames are 3–20 characters: letters, numbers and underscores.' };
	}
	if ((config.username.reserved as readonly string[]).includes(username.toLowerCase())) {
		return { ok: false, error: 'That name is reserved.' };
	}
	return { ok: true, username };
}
