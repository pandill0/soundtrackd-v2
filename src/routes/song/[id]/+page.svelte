<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import { openRateModal } from '$lib/rate-modal.svelte';
	import { formatAvg, ratingLabel, starString } from '$lib/stars';
	import { formatDuration, plural } from '$lib/utils';

	let { data } = $props();
	const track = $derived(data.track);
	const cover = $derived(track.cover_url ?? data.album?.cover_url ?? null);
	const artistName = $derived(data.artist?.title ?? track.artist_name ?? '');

	function rate() {
		openRateModal(
			{ kind: 'track', id: track.id, title: track.title, artist: artistName, cover, albumId: data.album?.id ?? null },
			data.myRating ? { rating: Number(data.myRating.rating), review: data.myRating.review } : null
		);
	}
	function setReviewSort(sort: 'recent' | 'top') {
		const url = new URL(page.url);
		if (sort === 'recent') url.searchParams.delete('reviews');
		else url.searchParams.set('reviews', sort);
		goto(url, { noScroll: true, keepFocus: true, replaceState: true });
	}
</script>

<svelte:head>
	<title>{track.title}{artistName ? ` · ${artistName}` : ''} · Soundtrackd</title>
</svelte:head>

<div class="container page">
	<header class="hero">
		{#if cover}<img class="hero-cover" src={cover} alt="" width="160" height="160" />{/if}
		<div class="hero-info">
			<div class="eyebrow">Song</div>
			<h1>{track.title}</h1>
			<div class="by">
				{#if data.artist}<a href="/artist/{data.artist.id}" class="accent">{data.artist.title}</a>{:else}{artistName}{/if}
				{#if data.album}<span class="muted"> · from </span><a href="/album/{data.album.id}" class="link">{data.album.title}</a>{/if}
			</div>
			<div class="muted small meta">
				{[data.album?.release_year, track.position ? `Track ${track.position}` : null, formatDuration(track.duration_ms)].filter(Boolean).join(' · ')}
			</div>
		</div>
	</header>

	<div class="cols">
		<main class="main">
			<section class="section first" aria-labelledby="lyrics">
				<h2 id="lyrics" class="section-title">Lyrics</h2>
				{#await data.lyrics}
					<div class="skeleton" style="height:120px"></div>
				{:then lyrics}
					{#if lyrics}
						<pre class="lyrics">{lyrics}</pre>
					{:else}
						<p class="muted small">No lyrics available for this one.</p>
					{/if}
				{:catch}
					<p class="muted small">No lyrics available for this one.</p>
				{/await}
			</section>

			<section class="section" aria-labelledby="reviews">
				<div class="section-head">
					<h2 id="reviews" class="section-title">Reviews</h2>
					<div class="row">
						<button class="tab" class:active={data.reviewSort === 'recent'} onclick={() => setReviewSort('recent')}>Recent</button>
						<button class="tab" class:active={data.reviewSort === 'top'} onclick={() => setReviewSort('top')}>Top</button>
					</div>
				</div>
				{#if data.reviews.length}
					<div class="stack">{#each data.reviews as r (r.id)}<ReviewCard review={r as never} likeable={false} />{/each}</div>
				{:else}
					<div class="empty">No reviews for this song yet.<br /><button class="btn btn-sm btn-primary" onclick={rate}>Rate & review</button></div>
				{/if}
			</section>
		</main>

		<aside class="aside">
			<div class="card">
				{#if data.stats?.rating_count}
					<div class="avg-row">
						<span class="avg-rating">{formatAvg(data.stats.avg_rating)}</span>
						<div>
							<Stars value={data.stats.avg_rating ?? 0} size="0.95rem" />
							<div class="muted tiny">{plural(data.stats.rating_count, 'rating')}</div>
						</div>
					</div>
					<RatingDistribution buckets={data.distribution} />
				{:else}
					<div class="muted small">No community rating yet.</div>
				{/if}
			</div>
			<div class="card stack">
				{#if data.myRating}
					<div class="eyebrow">Your rating</div>
					<button class="mine" onclick={rate}><Stars value={Number(data.myRating.rating)} size="1.2rem" /> <span class="gold serif">{ratingLabel(Number(data.myRating.rating))}</span></button>
					<button class="btn btn-sm btn-ghost" onclick={rate}>Edit</button>
				{:else}
					<button class="btn btn-primary" onclick={rate}>★ Rate this song</button>
				{/if}
			</div>
			{#if page.data.user}
				<div class="card">
					<div class="eyebrow">People you follow</div>
					{#if data.friends.length}
						<ul class="friends">
							{#each data.friends as f (f.user_id)}
								<li>
									<Avatar profile={{ id: String(f.user_id), username: String(f.username), avatar_url: f.avatar_url as string | null, accent_color: f.accent_color as string | null, supporter_until: f.supporter_until as string | null }} size={28} />
									<a class="truncate grow" href="/profile/{encodeURIComponent(String(f.username))}">{f.username}</a>
									<span class="gold small">{starString(Number(f.rating))}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted small">Nobody you follow has rated this yet.</p>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
</div>

<style>
	.hero {
		display: flex;
		gap: 1.5rem;
		align-items: flex-end;
		margin-bottom: 2rem;
	}
	.hero-cover {
		width: 160px;
		height: 160px;
		border-radius: var(--radius);
		object-fit: cover;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
	}
	.hero h1 {
		font-size: 2.2rem;
		margin: 0.15rem 0 0.3rem;
		text-shadow: var(--glow-green);
	}
	.by {
		font-size: 1.05rem;
	}
	.meta {
		margin-top: 0.4rem;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: 2rem;
		align-items: start;
	}
	.section.first {
		margin-top: 0;
	}
	.aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.avg-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 0.9rem;
	}
	.mine {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.lyrics {
		white-space: pre-wrap;
		font-family: var(--font-sans);
		font-size: 0.95rem;
		line-height: 1.7;
		color: var(--text);
		max-width: 60ch;
	}
	.friends {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.friends li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	@media (max-width: 780px) {
		.cols {
			grid-template-columns: 1fr;
		}
		.hero {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
