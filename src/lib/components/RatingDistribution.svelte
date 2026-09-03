<script lang="ts">
	/** Ten half-star buckets as a bar chart — the album page's signature widget. */
	let { buckets, compact = false }: { buckets: { bucket: number; n: number }[]; compact?: boolean } = $props();
	const max = $derived(Math.max(1, ...buckets.map((b) => b.n)));
	const total = $derived(buckets.reduce((s, b) => s + b.n, 0));
</script>

<div class="dist" class:compact aria-label="Rating distribution" role="img">
	{#each buckets as b (b.bucket)}
		<div class="col" title="{b.n} × {b.bucket} stars">
			<div class="bar" style="height:{Math.max(b.n ? 6 : 2, (b.n / max) * 100)}%"></div>
		</div>
	{/each}
</div>
{#if !compact}
	<div class="axis">
		<span>½</span><span>★</span><span>★★</span><span>★★★</span><span>★★★★</span><span>★★★★★</span>
	</div>
	<div class="muted tiny">{total} rating{total === 1 ? '' : 's'}</div>
{/if}

<style>
	.dist {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 64px;
	}
	.dist.compact {
		height: 28px;
		gap: 2px;
	}
	.col {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}
	.bar {
		width: 100%;
		background: var(--star);
		opacity: 0.85;
		border-radius: 2px 2px 0 0;
		transition: height 0.3s ease;
		min-height: 2px;
	}
	.col:hover .bar {
		opacity: 1;
		box-shadow: var(--glow-gold);
	}
	.axis {
		display: flex;
		justify-content: space-between;
		font-size: 0.6rem;
		color: var(--muted);
		margin-top: 0.3rem;
		letter-spacing: -0.02em;
	}
</style>
