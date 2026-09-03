/**
 * Affiliate links (REBUILD-SPEC §13.2A). One config map of partner → URL template + tag.
 * Every template degrades to a plain search URL when no tag is configured, so the row ships
 * and works before any affiliate application is approved. Tags live in server env only.
 */
import { serverEnv } from './env';

export interface AffiliateLink {
	partner: string;
	label: string;
	href: string;
	/** true when a tag is configured → rel="sponsored" */
	sponsored: boolean;
}

type Entity = { kind: 'album' | 'artist'; title: string; artist_name?: string | null };

const enc = (s: string) => encodeURIComponent(s.trim());

const PARTNERS: Record<string, { label: string; for: Entity['kind'][]; url: (q: string, e: Entity) => string; tag: () => string }> = {
	amazon: {
		label: 'Amazon',
		for: ['album'],
		tag: () => serverEnv.affiliate.amazonTag,
		url: (q) => `https://www.amazon.com/s?k=${q}&i=music-intl-ship${serverEnv.affiliate.amazonTag ? `&tag=${enc(serverEnv.affiliate.amazonTag)}` : ''}`
	},
	bandcamp: {
		label: 'Bandcamp',
		for: ['album', 'artist'],
		tag: () => '',
		url: (q, e) => `https://bandcamp.com/search?q=${q}&item_type=${e.kind === 'album' ? 'a' : 'b'}`
	},
	discogs: {
		label: 'Discogs',
		for: ['album', 'artist'],
		tag: () => '',
		url: (q, e) => `https://www.discogs.com/search/?q=${q}&type=${e.kind === 'album' ? 'release' : 'artist'}`
	},
	spotify: {
		label: 'Spotify',
		for: ['album', 'artist'],
		tag: () => '',
		url: (q, e) => `https://open.spotify.com/search/${q}/${e.kind === 'album' ? 'albums' : 'artists'}`
	},
	apple: {
		label: 'Apple Music',
		for: ['album', 'artist'],
		tag: () => '',
		url: (q) => `https://music.apple.com/us/search?term=${q}`
	},
	ticketmaster: {
		label: 'Tickets',
		for: ['artist'],
		tag: () => serverEnv.affiliate.ticketmasterTag,
		url: (q) => `https://www.ticketmaster.com/search?q=${q}${serverEnv.affiliate.ticketmasterTag ? `&${serverEnv.affiliate.ticketmasterTag}` : ''}`
	},
	bandsintown: {
		label: 'Tour dates',
		for: ['artist'],
		tag: () => '',
		url: (q) => `https://www.bandsintown.com/?came_from=257&q=${q}`
	}
};

export function buildLinks(entity: Entity): AffiliateLink[] {
	const q = enc(entity.kind === 'album' ? `${entity.artist_name ?? ''} ${entity.title}` : entity.title);
	return Object.entries(PARTNERS)
		.filter(([, p]) => p.for.includes(entity.kind))
		.map(([partner, p]) => ({ partner, label: p.label, href: p.url(q, entity), sponsored: p.tag().length > 0 }));
}
