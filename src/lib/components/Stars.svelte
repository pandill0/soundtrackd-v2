<script lang="ts">
	import { STAR_PATH, STAR_XS, starClipWidth } from '$lib/stars';

	/** Read-only star display. SVG, so half stars are exact in every browser and font. */
	let {
		value = 0,
		size = '1rem',
		title = undefined
	}: { value?: number | null; size?: string; title?: string } = $props();

	const id = $props.id();
	const v = $derived(Math.max(0, Math.min(5, Number(value) || 0)));
	const clip = $derived(starClipWidth(v));
</script>

<svg
	class="stars"
	viewBox="0 0 108 20"
	style="height:{size};width:calc({size} * 5.4)"
	role="img"
	aria-label={title ?? `${v} out of 5 stars`}
>
	{#if title}<title>{title}</title>{/if}
	<defs>
		<clipPath id="stars-{id}"><rect x="0" y="0" width={clip} height="20" /></clipPath>
	</defs>
	<g class="empty">
		{#each STAR_XS as x (x)}<path d={STAR_PATH} transform="translate({x} 0)" />{/each}
	</g>
	<g class="fill" clip-path="url(#stars-{id})">
		{#each STAR_XS as x (x)}<path d={STAR_PATH} transform="translate({x} 0)" />{/each}
	</g>
</svg>

<style>
	.stars {
		display: inline-block;
		vertical-align: middle;
		flex-shrink: 0;
	}
	.empty {
		fill: var(--surface2);
	}
	.fill {
		fill: var(--star);
	}
</style>
