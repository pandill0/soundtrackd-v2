/**
 * The one entitlement helper (REBUILD-SPEC §13.2C). Every supporter check in the app goes
 * through here, reading one source of truth: profiles.supporter_until. The SQL function
 * public.is_supporter(profiles) applies the same rule inside the database.
 *
 * Lapsing is non-destructive: when supporter_until passes, this returns false and the account
 * behaves like a free account. Nothing else changes.
 */
import type { Profile, ProfileCard } from './types';

type SupporterFields = Partial<Pick<Profile, 'supporter_until'>> | ProfileCard | null | undefined;

export function isSupporter(profile: SupporterFields): boolean {
	const until = profile?.supporter_until;
	if (!until) return false;
	return new Date(until).getTime() > Date.now();
}

/** Accent colour only renders for active supporters (§13.2B). */
export function supporterAccent(profile: SupporterFields & { accent_color?: string | null }): string | null {
	if (!isSupporter(profile)) return null;
	const c = profile?.accent_color;
	return c && /^#[0-9a-f]{6}$/i.test(c) ? c : null;
}
