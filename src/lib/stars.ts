/**
 * The rating system (REBUILD-SPEC §9). Half-stars from 0.5 to 5.0 and the
 * labels that are "part of the product's voice". Keep them.
 */
export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type RatingValue = (typeof RATING_STEPS)[number];

export const RATING_LABELS: Record<string, string> = {
	'0.5': 'painful',
	'1': 'bad',
	'1.5': 'poor',
	'2': 'ok',
	'2.5': 'mixed',
	'3': 'decent',
	'3.5': 'good',
	'4': 'great',
	'4.5': 'excellent',
	'5': 'masterpiece'
};

/** "★★★½" for 3.5, "½" for 0.5 */
export function starString(value: number): string {
	const full = Math.floor(value);
	const half = value - full >= 0.5;
	return '★'.repeat(full) + (half ? '½' : '');
}

export function ratingLabel(value: number): string {
	return RATING_LABELS[String(value)] ?? '';
}

/** "3.5" → "3.5", 4 → "4", null → "–" */
export function formatAvg(value: number | null | undefined, digits = 1): string {
	if (value == null || Number.isNaN(value)) return '–';
	return Number(value).toFixed(digits).replace(/\.0$/, '');
}

export function isValidRating(value: unknown): value is RatingValue {
	return typeof value === 'number' && (RATING_STEPS as readonly number[]).includes(value);
}
