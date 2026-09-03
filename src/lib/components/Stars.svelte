<script lang="ts">
	/** Read-only star display. Handles any half-step from 0 to 5. */
	let {
		value = 0,
		size = '1rem',
		title = undefined
	}: { value?: number | null; size?: string; title?: string } = $props();

	const v = $derived(Math.max(0, Math.min(5, Number(value) || 0)));
	const pct = $derived((v / 5) * 100);
</script>

<span
	class="stars"
	style="font-size:{size}"
	role="img"
	aria-label={title ?? `${v} out of 5 stars`}
	{title}
>
	<span class="empty" aria-hidden="true">★★★★★</span>
	<span class="fill" style="width:{pct}%" aria-hidden="true">★★★★★</span>
</span>

<style>
	.stars {
		position: relative;
		display: inline-block;
		line-height: 1;
		letter-spacing: 0.06em;
		white-space: nowrap;
		vertical-align: middle;
	}
	.empty {
		color: var(--surface2);
	}
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		overflow: hidden;
		color: var(--star);
		white-space: nowrap;
	}
</style>
