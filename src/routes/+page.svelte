<script lang="ts">
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import Carousel from '$lib/components/Carousel.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import VinylHero from '$lib/components/VinylHero.svelte';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();

	// Album order and column offsets randomise per page load (§3).
	const COLS = 8;
	const shuffled = $derived([...data.covers].sort(() => Math.random() - 0.5));
	const columns = $derived(
		Array.from({ length: COLS }, (_, c) => ({
			offset: -Math.floor(Math.random() * 40),
			covers: shuffled.filter((_, i) => i % COLS === c)
		}))
	);
</script>

<svelte:head>
	<title>Soundtrackd — Letterboxd, for music</title>
	<meta name="description" content="Rate albums and songs, write reviews, follow people whose taste you trust, and discover your next favourite record through them." />
</svelte:head>

<section class="hero">
	{#if data.covers.length >= 8}
		<div class="hero-bg" aria-hidden="true">
			{#each columns as col, c (c)}
				<div class="col" style="--offset:{col.offset}px;--dur:{55 + c * 3}s">
					{#each [...col.covers, ...col.covers] as url, i (i)}
						<img src={url} alt="" loading={i < 8 ? 'eager' : 'lazy'} decoding="async" />
					{/each}
				</div>
			{/each}
		</div>
	{/if}
	<div class="container hero-inner">
		<div class="hero-copy">
			<div class="eyebrow">Now in beta</div>
			<h1>Letterboxd,<br /><em>for music.</em></h1>
			<p class="lede">
				Log the records you hear with half-star ratings and honest reviews. Follow people whose taste you trust.
				Find the next one through them — not an algorithm.
			</p>
			<div class="cta-row">
				<a class="btn btn-primary shine big" href="/login?mode=signup">Create your account</a>
				<a class="btn btn-ghost big" href="/login">Sign in</a>
			</div>
			<p class="muted tiny">Free, forever, for everything social. Albums and songs. No player, no ads.</p>
		</div>
		<div class="hero-art">
			{#await data.trending}
				<VinylHero cover={null} />
			{:then t}
				<VinylHero cover={t[0]?.cover_url ?? null} />
			{:catch}
				<VinylHero cover={null} />
			{/await}
		</div>
	</div>
</section>

<div class="container page landing">
	{#await Promise.all([data.trending, data.trendingStats])}
		<div class="skeleton" style="height:240px"></div>
	{:then [trending, stats]}
		<Carousel items={trending} {stats} />
	{:catch}
		<!-- trending is a nice-to-have -->
	{/await}

	{#if data.starters.length}
		<section class="section">
			<div class="section-head"><h2 class="section-title">Opinion starters</h2><a class="more" href="/charts">All charts →</a></div>
			<div class="album-grid">
				{#each data.starters as a (a.id)}
					<AlbumCard item={{ id: String(a.id), kind: 'album', title: String(a.title), artist_name: a.artist_name as string | null, cover_url: a.cover_url as string | null, release_year: a.release_year as number | null, artist_id: a.artist_id as string | null, parent_id: null, mbid: null, release_date: null, genres: [], record_type: null, duration_ms: null, position: null, label: null, track_count: null, fetched_at: '' }} stats={{ avg_rating: a.avg_rating as number | null, rating_count: Number(a.rating_count) }} />
				{/each}
			</div>
		</section>
	{/if}

	{#if data.reviews.length}
		<section class="section">
			<div class="section-head"><h2 class="section-title">What members are saying</h2><a class="more" href="/members">Meet the members →</a></div>
			<div class="reviews">
				{#each data.reviews as r (r.id)}
					<ReviewCard
						review={{ id: String(r.id), user_id: String(r.user_id), username: String(r.username), avatar_url: r.avatar_url as string | null, accent_color: r.accent_color as string | null, supporter_until: r.supporter_until as string | null, rating: Number(r.rating), review: String(r.review), created_at: String(r.created_at), like_count: Number(r.like_count ?? 0) }}
						about={{ title: String(r.title ?? ''), subtitle: r.artist_name as string | null, cover: r.cover_url as string | null, href: r.item_id ? `/album/${r.item_id}` : `/search?q=${encodeURIComponent(String(r.title ?? ''))}` }}
					/>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.lists.length}
		<section class="section">
			<div class="section-head"><h2 class="section-title">Popular lists</h2><a class="more" href="/lists">All lists →</a></div>
			<div class="lists">
				{#each data.lists as l (l.id)}
					<a class="card tight list-card" href="/list/{l.id}">
						<div class="covers">{#each (l.items as { cover?: string }[]).slice(0, 4) as it, i (i)}<img src={it.cover} alt="" loading="lazy" />{/each}</div>
						<div class="grow truncate"><div class="t truncate">{l.title}</div><div class="muted tiny">{l.username} · {l.item_count} items · {timeAgo(String(l.updated_at))}</div></div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="section final">
		<h2 class="serif">Your taste, on the record.</h2>
		<p class="muted">Every rating you log makes the charts a little more honest and your friends' feeds a little more interesting.</p>
		<a class="btn btn-primary shine big" href="/login?mode=signup">Join Soundtrackd</a>
	</section>
</div>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid var(--border);
		min-height: 560px;
		display: flex;
		align-items: center;
	}
	.hero-bg {
		position: absolute;
		inset: -12% -10%;
		display: flex;
		gap: 10px;
		transform: rotate(-5deg);
		opacity: 0.14;
		filter: saturate(0.55) brightness(0.85);
		pointer-events: none;
		mask-image: linear-gradient(to right, transparent, #000 15%, #000 85%, transparent), linear-gradient(to bottom, #000 60%, transparent);
		mask-composite: intersect;
		-webkit-mask-image: linear-gradient(to right, transparent, #000 15%, #000 85%, transparent), linear-gradient(to bottom, #000 60%, transparent);
		-webkit-mask-composite: source-in;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
		transform: translateY(var(--offset));
		animation: drift var(--dur) linear infinite;
	}
	.col img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 6px;
	}
	@keyframes drift {
		to {
			transform: translateY(calc(var(--offset) - 50%));
		}
	}
	.hero-inner {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		align-items: center;
		gap: 2rem;
		padding-top: 4rem;
		padding-bottom: 4rem;
	}
	.hero h1 {
		font-size: 3.6rem;
		line-height: 1.05;
		margin: 0.3rem 0 1rem;
		text-shadow: var(--glow-green);
	}
	.hero h1 em {
		color: var(--accent);
	}
	.lede {
		font-size: 1.1rem;
		max-width: 46ch;
		margin-bottom: 1.5rem;
	}
	.cta-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}
	.btn.big {
		padding: 0.85rem 1.5rem;
		font-size: 1rem;
	}
	.hero-art {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1rem 0;
	}
	.landing {
		padding-top: 2rem;
	}
	.reviews {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 0.9rem;
		align-items: start;
	}
	.lists {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 0.75rem;
	}
	.list-card {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.covers {
		display: flex;
		flex-shrink: 0;
	}
	.covers img {
		width: 44px;
		height: 44px;
		border-radius: 4px;
		margin-left: -14px;
		box-shadow: -2px 0 6px rgba(0, 0, 0, 0.4);
		background: var(--surface2);
	}
	.covers img:first-child {
		margin-left: 0;
	}
	.list-card .t {
		font-weight: 500;
	}
	.final {
		text-align: center;
		padding: 3rem 1rem;
		border-top: 1px solid var(--border);
	}
	.final h2 {
		font-size: 2rem;
		text-shadow: var(--glow-green);
		margin-bottom: 0.5rem;
	}
	.final p {
		max-width: 50ch;
		margin: 0 auto 1.25rem;
	}
	@media (max-width: 780px) {
		.hero-inner {
			grid-template-columns: 1fr;
			padding-top: 2.5rem;
			padding-bottom: 2rem;
		}
		.hero h1 {
			font-size: 2.6rem;
		}
		.hero-art {
			order: -1;
			padding: 0;
		}
		.hero-art :global(.turntable) {
			--size: 220px !important;
			width: 220px;
			height: 220px;
		}
		.hero-art :global(canvas) {
			width: 220px !important;
			height: 220px !important;
		}
		.reviews {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.col {
			animation: none;
		}
	}
</style>
