/**
 * Global state for the rating modal (mounted once in +layout.svelte).
 * Any page calls openRateModal(...) instead of owning its own modal — one implementation,
 * not thirteen (§2).
 */
export interface RateTarget {
	kind: 'album' | 'track';
	id: string; // catalog_items.id
	title: string;
	artist: string | null;
	cover: string | null;
	/** for tracks: the parent album's catalog id, so track ratings roll up (§11 bug #4) */
	albumId?: string | null;
}
export interface ExistingRating {
	rating: number;
	review: string | null;
}

export const rateModal = $state({
	open: false,
	target: null as RateTarget | null,
	existing: null as ExistingRating | null,
	onSaved: null as null | ((result: ExistingRating | null) => void)
});

export function openRateModal(
	target: RateTarget,
	existing: ExistingRating | null = null,
	onSaved: ((result: ExistingRating | null) => void) | null = null
) {
	rateModal.target = target;
	rateModal.existing = existing;
	rateModal.onSaved = onSaved;
	rateModal.open = true;
}

export function closeRateModal() {
	rateModal.open = false;
	rateModal.target = null;
	rateModal.existing = null;
	rateModal.onSaved = null;
}
