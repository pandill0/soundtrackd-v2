<script lang="ts">
	import type { CatalogItem } from '$lib/types';
	import { formatAvg } from '$lib/stars';
	import { onMount } from 'svelte';

	/** The featured carousel (§8): auto-advances every 5s, pauses on hover. */
	let {
		items,
		stats = {},
		title = 'Featured this week',
		attribution = 'Trending via Last.fm'
	}: { items: CatalogItem[]; stats?: Record<string, { avg_rating: number | null; rating_count: number }>; title?: string; attribution?: string } = $props();

	let i = $state(0);
	let paused = $state(false);
	const current = $derived(items[i]);

	onMount(() => {
		const t = setInterval(() => {
			if (!paused && items.length > 1) i = (i + 1) % items.length;
		}, 5000);
		return () => clearInterval(t);
	});
</script>

{#if items.length}
	<section class="carousel" onmouseenter={() => (paused = true)} onmouseleave={() => (paused = false)} aria-roledescription="carousel" aria-label={title}>
		<div class="section-head"><h2 class="section-title">{title}</h2><span class="muted tiny">{attribution}</span></div>
		<div class="stage card">
			{#key current.id}
				<a class="slide" href="/album/{current.id}">
					{#if current.cover_url}<img src={current.cover_url} alt="" width="180" height="180" />{/if}
					<div class="grow">
						<div class="eyebrow">{i + 1} / {items.length}</div>
						<h3 class="serif">{current.title}</h3>
						<div class="muted">{current.artist_name}{#if current.release_year} · {current.release_year}{/if}</div>
						<div class="rating">
							{#if stats[current.id]?.rating_count}
								<span class="avg-rating small-avg">{formatAvg(stats[current.id].avg_rating)}</span>
								<span class="muted tiny">{stats[current.id].rating_count} community rating{stats[current.id].rating_count === 1 ? '' : 's'}</span>
							{:else}
								<span class="muted small">Nobody here has rated this yet — be first.</span>
							{/if}
						</div>
					</div>
				</a>
			{/key}
			<div class="dots" role="tablist">
				{#each items as it, k (it.id)}
					<button class="dot" class:on={k === i} onclick={() => (i = k)} aria-label="Slide {k + 1}" role="tab" aria-selected={k === i}></button>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	.stage {
		position: relative;
		overflow: hidden;
		padding: 1.25rem;
	}
	.slide {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		animation: fadeIn 0.5s ease both;
	}
	.slide img {
		width: 180px;
		height: 180px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}
	.slide h3 {
		font-size: 1.7rem;
		margin: 0.15rem 0 0.2rem;
	}
	.rating {
		margin-top: 0.8rem;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.small-avg {
		font-size: 1.8rem;
	}
	.dots {
		display: flex;
		gap: 0.35rem;
		justify-content: center;
		margin-top: 1rem;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--surface2);
		padding: 0;
	}
	.dot.on {
		background: var(--accent);
		box-shadow: var(--glow-green);
	}
	@media (max-width: 580px) {
		.slide {
			flex-direction: column;
			align-items: flex-start;
		}
		.slide img {
			width: 140px;
			height: 140px;
		}
	}
</style>
