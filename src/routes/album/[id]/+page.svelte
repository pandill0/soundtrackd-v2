<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import NowSpinningButton from '$lib/components/NowSpinningButton.svelte';
	import QueueButton from '$lib/components/QueueButton.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import { openRateModal } from '$lib/rate-modal.svelte';
	import { formatAvg, ratingLabel, starString } from '$lib/stars';
	import { formatDate, formatDuration, formatRuntime, plural } from '$lib/utils';

	let { data } = $props();

	const album = $derived(data.album);
	const runtime = $derived(album.duration_ms ?? data.tracks.reduce((s, t) => s + (t.duration_ms ?? 0), 0));
	const meta = $derived(
		[
			album.release_date ? formatDate(album.release_date) : album.release_year,
			album.record_type && album.record_type !== 'album' ? album.record_type.toUpperCase() : null,
			album.label,
			runtime ? formatRuntime(runtime) : null,
			data.tracks.length ? plural(data.tracks.length, 'track') : album.track_count ? plural(album.track_count, 'track') : null
		].filter(Boolean)
	);
	const medals = ['🥇', '🥈', '🥉'];

	function rateAlbum() {
		openRateModal(
			{ kind: 'album', id: album.id, title: album.title, artist: album.artist_name, cover: album.cover_url },
			data.myRating ? { rating: Number(data.myRating.rating), review: data.myRating.review } : null
		);
	}
	function rateTrack(t: (typeof data.tracks)[number]) {
		const mine = data.trackStats[t.id]?.my_rating;
		openRateModal(
			{ kind: 'track', id: t.id, title: t.title, artist: t.artist_name ?? album.artist_name, cover: album.cover_url, albumId: album.id },
			mine ? { rating: Number(mine), review: null } : null
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
	<title>{album.title}{album.artist_name ? ` · ${album.artist_name}` : ''} · Soundtrackd</title>
	<meta name="description" content="Community ratings and reviews for {album.title}{album.artist_name ? ` by ${album.artist_name}` : ''} on Soundtrackd." />
	{#if album.cover_url}<meta property="og:image" content={album.cover_url} />{/if}
</svelte:head>

<div class="container page album-page">
	{#if data.devMode}
		<p class="devnote tiny">Dev mode: catalogue is in memory (no SUPABASE_SECRET_KEY). Browsing works; rating needs the real database.</p>
	{/if}

	<header class="hero">
		{#if album.cover_url}
			<img class="hero-cover" src={album.cover_url} alt="{album.title} cover" width="220" height="220" />
		{:else}
			<div class="hero-cover cover placeholder"></div>
		{/if}
		<div class="hero-info">
			<div class="eyebrow">{album.record_type && album.record_type !== 'album' ? album.record_type : 'Album'}</div>
			<h1>{album.title}</h1>
			{#if data.artist}
				<a href="/artist/{data.artist.id}" class="artist-link">{data.artist.title}</a>
			{:else if album.artist_name}
				<div class="artist-link">{album.artist_name}</div>
			{/if}
			<div class="meta muted small">{meta.join(' · ')}</div>
			{#if album.genres.length}
				<div class="genres">{#each album.genres as g (g)}<a class="tag" href="/charts?genre={encodeURIComponent(g)}">{g}</a>{/each}</div>
			{/if}
		</div>
	</header>

	<div class="cols">
		<main class="main">
			<!-- Tracklist -->
			<section class="section" aria-labelledby="tracks">
				<h2 id="tracks" class="section-title">Tracks</h2>
				{#if data.tracks.length}
					<ol class="tracklist">
						{#each data.tracks as t, i (t.id)}
							{@const s = data.trackStats[t.id]}
							{@const medal = data.trophies.indexOf(t.id)}
							<li class="track">
								<span class="num muted">{t.position ?? i + 1}</span>
								<a class="track-title truncate" href="/song/{t.id}">{t.title}</a>
								{#if medal >= 0}<span class="medal" title="Top rated track">{medals[medal]}</span>{/if}
								<span class="track-avg" title={s?.rating_count ? `${s.rating_count} rating${s.rating_count === 1 ? '' : 's'}` : 'No ratings yet'}>
									{#if s?.rating_count}<span class="gold">★ {formatAvg(s.avg_rating)}</span> <span class="muted tiny">{s.rating_count}</span>{/if}
								</span>
								<button class="track-mine" class:has={s?.my_rating} onclick={() => rateTrack(t)} title={s?.my_rating ? `Your rating: ${starString(Number(s.my_rating))}` : 'Rate this track'}>
									{s?.my_rating ? starString(Number(s.my_rating)) : '☆'}
								</button>
								<span class="dur muted tiny">{formatDuration(t.duration_ms)}</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="muted small">No tracklist available for this record.</p>
				{/if}
			</section>

			<!-- Reviews -->
			<section class="section" aria-labelledby="reviews">
				<div class="section-head">
					<h2 id="reviews" class="section-title">Reviews</h2>
					<div class="tabs mini">
						<button class="tab" class:active={data.reviewSort === 'recent'} onclick={() => setReviewSort('recent')}>Recent</button>
						<button class="tab" class:active={data.reviewSort === 'top'} onclick={() => setReviewSort('top')}>Top</button>
					</div>
				</div>
				{#if data.reviews.length}
					<div class="stack">
						{#each data.reviews as r (r.id)}
							<ReviewCard review={r as never} />
						{/each}
					</div>
				{:else}
					<div class="empty">
						No reviews yet. {#if data.myRating}Add a few words to your rating.{:else}Be the first to say something.{/if}
						<br /><button class="btn btn-sm btn-primary" onclick={rateAlbum}>{data.myRating ? 'Edit your rating' : 'Rate & review'}</button>
					</div>
				{/if}
			</section>

			{#if data.moreBy.length}
				<section class="section" aria-labelledby="more">
					<div class="section-head">
						<h2 id="more" class="section-title">More by {album.artist_name}</h2>
						{#if data.artist}<a class="more" href="/artist/{data.artist.id}">Full discography →</a>{/if}
					</div>
					<div class="album-grid small">
						{#each data.moreBy as a (a.id)}
							<AlbumCard item={a} stats={data.moreStats[a.id]} showArtist={false} />
						{/each}
					</div>
				</section>
			{/if}
		</main>

		<aside class="aside">
			<!-- Community rating -->
			<div class="card rating-card">
				{#if data.stats?.rating_count}
					<div class="avg-row">
						<span class="avg-rating">{formatAvg(data.stats.avg_rating)}</span>
						<div>
							<Stars value={data.stats.avg_rating ?? 0} size="0.95rem" />
							<div class="muted tiny">{plural(data.stats.rating_count, 'rating')} · {plural(data.stats.review_count, 'review')}</div>
						</div>
					</div>
					<RatingDistribution buckets={data.distribution} />
				{:else}
					<div class="muted small">No community rating yet.</div>
				{/if}
			</div>

			<!-- Your rating -->
			<div class="card mine-card">
				{#if data.myRating}
					<div class="eyebrow">Your rating</div>
					<button class="mine-stars" onclick={rateAlbum} title="Edit your rating">
						<Stars value={Number(data.myRating.rating)} size="1.2rem" />
						<span class="label">{ratingLabel(Number(data.myRating.rating))}</span>
					</button>
					{#if data.myRating.review}<p class="small muted clamp-3 prose">{data.myRating.review}</p>{/if}
					<button class="btn btn-sm btn-ghost" onclick={rateAlbum}>Edit</button>
				{:else}
					<button class="btn btn-primary wide" onclick={rateAlbum}>★ Rate this album</button>
				{/if}
				<div class="actions">
					<QueueButton itemId={album.id} inQueue={data.inQueue} />
					<NowSpinningButton itemId={album.id} active={data.nowSpinning} />
				</div>
			</div>

			<!-- Friends panel -->
			{#if page.data.user}
				<div class="card friends-card">
					<div class="eyebrow">People you follow</div>
					{#if data.friends.length}
						<ul class="friends">
							{#each data.friends as f (f.user_id)}
								<li>
									<Avatar profile={{ id: String(f.user_id), username: String(f.username), avatar_url: f.avatar_url as string | null, accent_color: f.accent_color as string | null, supporter_until: f.supporter_until as string | null }} size={28} />
									<a class="truncate" href="/profile/{encodeURIComponent(String(f.username))}">{f.username}</a>
									<span class="gold small">{starString(Number(f.rating))}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted small">Nobody you follow has rated this yet.</p>
					{/if}
				</div>
			{/if}

			<!-- Buy / listen elsewhere (§13.2A) -->
			<div class="card links-card">
				<div class="eyebrow">Buy / listen elsewhere</div>
				<div class="links">
					{#each data.links as l (l.partner)}
						<a href={l.href} target="_blank" rel={l.sponsored ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}>{l.label}</a>
					{/each}
				</div>
			</div>
		</aside>
	</div>
</div>

<style>
	.devnote {
		background: rgba(124, 111, 205, 0.15);
		color: #b3a9ee;
		padding: 0.4rem 0.7rem;
		border-radius: var(--radius-sm);
		margin-bottom: 1rem;
	}
	.hero {
		display: flex;
		gap: 1.75rem;
		align-items: flex-end;
		margin-bottom: 2rem;
	}
	.hero-cover {
		width: 220px;
		height: 220px;
		border-radius: var(--radius);
		object-fit: cover;
		flex-shrink: 0;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
		background: var(--surface2);
	}
	.hero-info {
		min-width: 0;
	}
	.hero h1 {
		font-size: 2.4rem;
		margin: 0.15rem 0 0.35rem;
		text-shadow: var(--glow-green);
	}
	.artist-link {
		font-size: 1.15rem;
		color: var(--accent);
	}
	.meta {
		margin-top: 0.5rem;
	}
	.genres {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-top: 0.6rem;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: 2rem;
		align-items: start;
	}
	.aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: sticky;
		top: calc(var(--nav-h) + 1rem);
	}
	.main .section:first-child {
		margin-top: 0;
	}
	.avg-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 0.9rem;
	}
	.mine-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.mine-stars {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
	}
	.mine-stars .label {
		font-family: var(--font-serif);
		color: var(--star);
	}
	.wide {
		width: 100%;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.actions :global(.btn) {
		width: 100%;
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
	.friends li a {
		flex: 1;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		margin-top: 0.4rem;
		font-size: 0.85rem;
	}
	.links a {
		color: var(--muted);
	}
	.links a:hover {
		color: var(--accent);
	}
	.tracklist {
		list-style: none;
	}
	.track {
		display: grid;
		grid-template-columns: 1.6rem minmax(0, 1fr) auto auto auto 3rem;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.25rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.92rem;
	}
	.track:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.num {
		font-variant-numeric: tabular-nums;
		font-size: 0.8rem;
	}
	.track-title:hover {
		color: var(--accent);
	}
	.track-avg {
		font-size: 0.8rem;
		min-width: 3.5rem;
		text-align: right;
	}
	.track-mine {
		color: var(--muted);
		font-size: 0.8rem;
		letter-spacing: 0.05em;
		min-width: 2rem;
		text-align: right;
	}
	.track-mine.has {
		color: var(--accent);
	}
	.track-mine:hover {
		color: var(--star);
	}
	.dur {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tabs.mini {
		border: 0;
		margin: 0;
	}
	.tabs.mini .tab {
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
	}
	@media (max-width: 780px) {
		.cols {
			grid-template-columns: 1fr;
		}
		.aside {
			position: static;
		}
		.hero {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
		.hero-cover {
			width: 180px;
			height: 180px;
		}
		.hero h1 {
			font-size: 1.9rem;
		}
		.track {
			grid-template-columns: 1.4rem minmax(0, 1fr) auto auto;
		}
		.medal,
		.dur {
			display: none;
		}
	}
</style>
