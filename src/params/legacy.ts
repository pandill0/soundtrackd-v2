import type { ParamMatcher } from '@sveltejs/kit';

/** Matches the v1 page file names so old links keep working. */
export const match: ParamMatcher = (param) =>
	/^(index|dash|login|search|album|song|artist|profile|lists|list|charts|members|followers)\.html$/.test(param);
