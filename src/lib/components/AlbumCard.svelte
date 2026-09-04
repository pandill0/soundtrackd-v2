<script lang="ts">
	import type { CatalogItem } from '$lib/types';
	import { formatAvg, starString } from '$lib/stars';
	import { coverSize } from '$lib/utils';

	interface Stats {
		avg_rating?: number | null;
		rating_count?: number | null;
		my_rating?: number | null;
	}
	let {
		item,
		stats = null,
		showArtist = true,
		href = undefined,
		subtitle = undefined
	}: { item: CatalogItem; stats?: Stats | null; showArtist?: boolean; href?: string; subtitle?: string } = $props();

	const link = $derived(href ?? (item.kind === 'artist' ? `/artist/${item.id}` : item.kind === 'track' ? `/song/${item.id}` : `/album/${item.id}`));
</script>

<a href={link} class="album-card">
	<div class="cover-wrap">
		{#if item.cover_url}
			<img class="cover" class:round={item.kind === 'artist'} src={coverSize(item.cover_url, 250)} alt="" loading="lazy" />
		{:else}
			<div class="cover placeholder" class:round={item.kind === 'artist'}></div>
		{/if}
		{#if stats?.rating_count && stats.avg_rating != null}
			<span class="pill" title="{stats.rating_count} rating{stats.rating_count === 1 ? '' : 's'}">★ {formatAvg(stats.avg_rating)}</span>
		{/if}
		{#if stats?.my_rating}
			<span class="mine" title="Your rating">{starString(Number(stats.my_rating))}</span>
		{/if}
	</div>
	<div class="title truncate" title={item.title}>{item.title}</div>
	{#if subtitle}
		<div class="artist truncate">{subtitle}</div>
	{:else if showArtist && item.artist_name}
		<div class="artist truncate">{item.artist_name}</div>
	{:else if item.release_year}
		<div class="artist truncate">{item.release_year}</div>
	{/if}
</a>

<style>
	.album-card {
		display: block;
		min-width: 0;
	}
	.cover-wrap {
		position: relative;
		margin-bottom: 0.45rem;
	}
	.cover {
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}
	@media (hover: hover) {
		.album-card:hover .cover {
			transform: translateY(-2px);
			box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
		}
	}
	.placeholder {
		background: linear-gradient(135deg, var(--surface2), #1c261e);
	}
	.pill {
		position: absolute;
		left: 6px;
		bottom: 6px;
		background: rgba(10, 15, 11, 0.85);
		color: var(--star);
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		backdrop-filter: blur(4px);
	}
	.mine {
		position: absolute;
		right: 6px;
		bottom: 6px;
		background: rgba(74, 158, 107, 0.9);
		color: #06110a;
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.15rem 0.4rem;
		border-radius: 999px;
		letter-spacing: 0.05em;
	}
	.title {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text);
		line-height: 1.3;
	}
	.artist {
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
