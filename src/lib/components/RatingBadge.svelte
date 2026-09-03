<script lang="ts">
	import { formatAvg } from '$lib/stars';
	/** "★ 4.2 · 12" — community average with count. Nothing renders when there are no ratings. */
	let {
		avg,
		count = 0,
		size = 'md'
	}: { avg: number | null | undefined; count?: number; size?: 'sm' | 'md' } = $props();
</script>

{#if count > 0 && avg != null}
	<span class="badge-rating" class:sm={size === 'sm'} title="{count} rating{count === 1 ? '' : 's'}">
		<span class="star">★</span>{formatAvg(avg)}<span class="count">·&nbsp;{count}</span>
	</span>
{/if}

<style>
	.badge-rating {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--star);
		white-space: nowrap;
	}
	.badge-rating.sm {
		font-size: 0.72rem;
	}
	.star {
		font-size: 0.9em;
	}
	.count {
		color: var(--muted);
		font-weight: 300;
	}
</style>
