<script lang="ts">
	import { onMount } from 'svelte';

	/** A number that counts up to its value on first paint. Respects reduced motion. */
	let { value, duration = 1600 }: { value: number; duration?: number } = $props();
	let shown = $state(0);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || value < 2) {
			shown = value;
			return;
		}
		const start = performance.now();
		let raf = 0;
		const step = (t: number) => {
			const p = Math.min(1, (t - start) / duration);
			const eased = 1 - Math.pow(1 - p, 3);
			shown = Math.round(value * eased);
			if (p < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});
</script>

<span class="ticker">{shown.toLocaleString()}</span>

<style>
	.ticker {
		font-variant-numeric: tabular-nums;
	}
</style>
