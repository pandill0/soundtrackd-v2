<script lang="ts">
	import { page } from '$app/state';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import { formatAvg, starString } from '$lib/stars';

	let { data } = $props();
	function tabHref(tab: string) {
		const url = new URL(page.url);
		if (tab === 'albums') url.searchParams.delete('tab');
		else url.searchParams.set('tab', tab);
		url.searchParams.delete('sort');
		return url.pathname + url.search;
	}
</script>

<svelte:head><title>Charts · Soundtrackd</title></svelte:head>

<div class="container page">
	<div class="section-head">
		<h1>Charts</h1>
		<span class="muted small">Community ratings, aggregated in the database.</span>
	</div>

	<div class="summary card tight">
		<div class="stat"><b>{data.summary.total.toLocaleString()}</b><span>ratings</span></div>
		<div class="stat"><b class="gold">{data.summary.mean != null ? formatAvg(data.summary.mean, 2) : '–'}</b><span>site average</span></div>
		<div class="stat"><b class="gold">{data.summary.mode != null ? starString(Number(data.summary.mode)) : '–'}</b><span>most common</span></div>
		<div class="stat grow"><RatingDistribution buckets={data.distribution} compact /><span>score distribution</span></div>
	</div>

	<nav class="tabs" aria-label="Chart">
		<a class="tab" class:active={data.tab === 'albums'} href={tabHref('albums')}>Albums</a>
		<a class="tab" class:active={data.tab === 'tracks'} href={tabHref('tracks')}>Songs</a>
		<a class="tab" class:active={data.tab === 'trending'} href={tabHref('trending')}>Trending worldwide</a>
	</nav>

	{#if data.tab === 'albums'}
		<SortBar
			sorts={[{ value: 'rating', label: 'Highest rated' }, { value: 'reviews', label: 'Most reviewed' }, { value: 'count', label: 'Most rated' }, { value: 'trending', label: 'Trending this week' }]}
			defaultSort="rating"
			allowDir={false}
			filters={[
				{ key: 'genre', label: 'Genre', options: data.genres.map((g) => ({ value: g, label: g })) },
				{ key: 'decade', label: 'Decade', options: data.decades.map((d) => ({ value: String(d), label: `${d}s` })) }
			]}
		/>
		{#if data.albums.length}
			<ol class="chart">
				{#each data.albums as a, i (a.id)}
					<li class="chart-row">
						<span class="rank">{i + 1}</span>
						<a href="/album/{a.id}">{#if a.cover_url}<img class="thumb lg" src={String(a.cover_url)} alt="" loading="lazy" />{:else}<span class="thumb lg"></span>{/if}</a>
						<div class="grow truncate">
							<a class="t" href="/album/{a.id}">{a.title}</a>
							<div class="muted small truncate">{#if a.artist_id}<a href="/artist/{a.artist_id}">{a.artist_name}</a>{:else}{a.artist_name ?? ''}{/if}{#if a.release_year} · {a.release_year}{/if}</div>
						</div>
						<div class="score"><span class="gold big">★ {formatAvg(a.avg_rating as number)}</span><span class="muted tiny">{a.rating_count} ratings · {a.review_count} reviews</span></div>
					</li>
				{/each}
			</ol>
		{:else}
			<div class="empty">No rated albums match. Rate something and it shows up here.</div>
		{/if}
	{:else if data.tab === 'tracks'}
		<SortBar sorts={[{ value: 'rating', label: 'Highest rated' }, { value: 'count', label: 'Most rated' }]} defaultSort="rating" allowDir={false} />
		{#if data.tracks.length}
			<ol class="chart">
				{#each data.tracks as t, i (t.id)}
					<li class="chart-row">
						<span class="rank">{i + 1}</span>
						<a href="/song/{t.id}">{#if t.cover_url}<img class="thumb" src={String(t.cover_url)} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}</a>
						<div class="grow truncate"><a class="t" href="/song/{t.id}">{t.title}</a><div class="muted small truncate">{t.artist_name ?? ''}</div></div>
						<div class="score"><span class="gold big">★ {formatAvg(t.avg_rating as number)}</span><span class="muted tiny">{t.rating_count} ratings</span></div>
					</li>
				{/each}
			</ol>
		{:else}
			<div class="empty">No rated songs yet.</div>
		{/if}
	{:else}
		<p class="muted small">What the world is playing this week, via Last.fm — with Soundtrackd's take on each.</p>
		{#await data.trending}
			<div class="album-grid">{#each Array(10) as _, i (i)}<div class="skeleton" style="aspect-ratio:1"></div>{/each}</div>
		{:then albums}
			{#if albums.length}
				<div class="album-grid">{#each albums as a (a.id)}<AlbumCard item={a} />{/each}</div>
			{:else}
				<div class="empty">Trending is unavailable right now.</div>
			{/if}
		{/await}
	{/if}
</div>

<style>
	.summary {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	.stat {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.stat b {
		font-family: var(--font-serif);
		font-size: 1.4rem;
		font-weight: 400;
	}
	.stat span {
		font-size: 0.68rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.stat.grow {
		min-width: 140px;
	}
	.chart {
		list-style: none;
	}
	.chart-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.6rem 0.25rem;
		border-bottom: 1px solid var(--border);
	}
	.rank {
		width: 1.8rem;
		font-family: var(--font-serif);
		font-size: 1.1rem;
		color: var(--muted);
		text-align: right;
	}
	.t {
		font-weight: 500;
	}
	.t:hover {
		color: var(--accent);
	}
	.score {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.2;
	}
	.score .big {
		font-size: 1.05rem;
		font-weight: 600;
	}
</style>
