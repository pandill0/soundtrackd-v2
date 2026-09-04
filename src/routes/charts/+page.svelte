<script lang="ts">
	import { page } from '$app/state';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import CrateDig from '$lib/components/CrateDig.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import Ticker from '$lib/components/Ticker.svelte';
	import { formatAvg, starString } from '$lib/stars';
	import type { CatalogItem } from '$lib/types';
	import { coverSize, formatDate, timeAgo } from '$lib/utils';

	let { data } = $props();

	const avg = $derived(data.stats.avg != null ? Number(data.stats.avg) : null);
	// The distribution has ten equal columns for ½…5; the average sits at the centre of its bucket.
	const avgPos = $derived(avg != null ? Math.max(2, Math.min(98, (2 * avg - 0.5) * 10)) : null);

	function tabHref(tab: string) {
		const url = new URL(page.url);
		if (tab === 'albums') url.searchParams.delete('tab');
		else url.searchParams.set('tab', tab);
		url.searchParams.delete('sort');
		return url.pathname + url.search + '#all-time';
	}
	const asItem = (r: Record<string, unknown>): CatalogItem => ({
		id: String(r.id), kind: 'album', title: String(r.title), artist_name: (r.artist_name as string | null) ?? null,
		artist_id: (r.artist_id as string | null) ?? null, cover_url: (r.cover_url as string | null) ?? null,
		release_year: (r.release_year as number | null) ?? null, parent_id: null, mbid: null, release_date: null,
		genres: [], record_type: null, duration_ms: null, position: null, label: null, track_count: null, fetched_at: ''
	});
</script>

<svelte:head><title>Charts · Soundtrackd</title></svelte:head>

<div class="container page charts">
	<div class="section-head">
		<h1>Charts</h1>
		<span class="muted small">What Soundtrackd is rating, right now and all time.</span>
	</div>

	<!-- ── Top box ─────────────────────────────────────────────── -->
	<div class="card topbox">
		<div class="numbers">
			<div class="big">
				<span class="ticker-num"><Ticker value={data.stats.total} /></span>
				<span class="lbl">ratings on Soundtrackd</span>
			</div>
			<div class="facts">
				<div class="fact" title="Album and song ratings in the last 24 hours"><b class="accent">{data.stats.today.toLocaleString()}</b><span>today</span></div>
				<div class="fact"><b class="gold">{avg != null ? formatAvg(avg) : '–'}</b><span>average</span></div>
				<div class="fact"><b>{data.stats.members.toLocaleString()}</b><span>members</span></div>
			</div>
			<div class="dist-box" title="How every album rating on the site is spread, ½ to 5 stars">
				<div class="dist-wrap">
					<RatingDistribution buckets={data.stats.distribution} compact />
					{#if avgPos != null}
						<span class="avg-mark" style="left:{avgPos}%"><span class="avg-tag">avg {formatAvg(avg)}</span></span>
					{/if}
				</div>
				<div class="axis tiny muted"><span>½</span><span>★★★★★</span></div>
			</div>
		</div>
		<CrateDig covers={data.covers} />
	</div>

	<!-- ── Highly rated this week ─────────────────────────────── -->
	<section class="section first">
		<div class="section-head"><h2 class="section-title">Highly rated this week</h2><span class="muted tiny">Ratings from the last 7 days</span></div>
		{#if data.week.length}
			<div class="album-grid">
				{#each data.week as a (a.id)}
					<AlbumCard item={asItem(a)} stats={{ avg_rating: a.week_avg as number, rating_count: Number(a.week_count) }} />
				{/each}
			</div>
		{:else}
			<div class="empty">Nothing rated yet this week. <a class="link" href="/search">Be the first.</a></div>
		{/if}
	</section>

	<!-- ── New releases from big artists ──────────────────────── -->
	<section class="section">
		<div class="section-head"><h2 class="section-title">New releases from big artists</h2><span class="muted tiny">The world's most-played artists, last four months</span></div>
		{#await data.releases}
			<div class="album-grid">{#each Array(6) as _, i (i)}<div class="skeleton" style="aspect-ratio:1"></div>{/each}</div>
		{:then rel}
			{#if rel.length}
				<div class="album-grid">
					{#each rel as a (a.id)}
						<AlbumCard item={a} subtitle={[a.artist_name, a.release_date ? formatDate(a.release_date, { year: undefined }) : null].filter(Boolean).join(' · ')} />
					{/each}
				</div>
			{:else}
				<div class="empty">New releases are unavailable right now.</div>
			{/if}
		{/await}
	</section>

	<!-- ── Trending with friends ──────────────────────────────── -->
	<section class="section">
		<div class="section-head"><h2 class="section-title">Trending with friends</h2><span class="muted tiny">What the people you follow rated in the last two weeks</span></div>
		{#if !data.signedIn}
			<div class="empty">Sign in to see what the people you follow are rating.<br /><a class="btn btn-sm btn-primary" href="/login?next=/charts">Sign in</a></div>
		{:else if data.friends.length}
			<div class="album-grid">
				{#each data.friends as a (a.id)}
					{@const friends = (a.friends as { username: string; avatar_url: string | null; rating: number }[]) ?? []}
					<div class="friend-pick">
						<AlbumCard item={asItem(a)} stats={{ avg_rating: a.friend_avg as number, rating_count: Number(a.friend_count) }} />
						<div class="who">
							{#each friends as f (f.username)}
								<a class="w" href="/profile/{encodeURIComponent(f.username)}" title="{f.username}: {starString(Number(f.rating))}">
									<Avatar profile={{ id: f.username, username: f.username, avatar_url: f.avatar_url, accent_color: null, supporter_until: null }} size={20} link={false} />
								</a>
							{/each}
							{#if Number(a.friend_count) > friends.length}<span class="muted tiny">+{Number(a.friend_count) - friends.length}</span>{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty">Follow a few members and their recent ratings show up here.<br /><a class="btn btn-sm btn-primary" href="/members">Browse members</a></div>
		{/if}
	</section>

	<!-- ── Artists you've rated ───────────────────────────────── -->
	{#if data.signedIn}
		<section class="section">
			<div class="section-head"><h2 class="section-title">Artists you've rated</h2><span class="muted tiny">Your average, most-rated first</span></div>
			{#if data.artists.length}
				<div class="artists">
					{#each data.artists as ar (ar.id)}
						<a class="artist" href="/artist/{ar.id}">
							{#if ar.cover_url}<img class="cover round" src={coverSize(String(ar.cover_url), 250)} alt="" loading="lazy" />{:else}<span class="cover round"></span>{/if}
							<span class="name truncate">{ar.title}</span>
							<span class="tiny"><span class="gold">★ {formatAvg(ar.avg_rating as number)}</span> <span class="muted">· {ar.rating_count} {Number(ar.rating_count) === 1 ? 'album' : 'albums'}</span></span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="muted small">Rate a few albums and their artists collect here.</p>
			{/if}
		</section>
	{/if}

	<!-- ── All time ───────────────────────────────────────────── -->
	<section class="section" id="all-time">
		<div class="section-head"><h2 class="section-title">All time</h2><span class="muted tiny">Community ratings, aggregated in the database</span></div>
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
							<a href="/album/{a.id}">{#if a.cover_url}<img class="thumb lg" src={coverSize(String(a.cover_url), 120)} alt="" loading="lazy" />{:else}<span class="thumb lg"></span>{/if}</a>
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
							<a href="/song/{t.id}">{#if t.cover_url}<img class="thumb" src={coverSize(String(t.cover_url), 120)} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}</a>
							<div class="grow truncate"><a class="t" href="/song/{t.id}">{t.title}</a><div class="muted small truncate">{t.artist_name ?? ''}</div></div>
							<div class="score"><span class="gold big">★ {formatAvg(t.avg_rating as number)}</span><span class="muted tiny">{t.rating_count} ratings</span></div>
						</li>
					{/each}
				</ol>
			{:else}
				<div class="empty">No rated songs yet.</div>
			{/if}
		{:else}
			<p class="muted small">What the world is playing this week, via Last.fm, with Soundtrackd's take on each.</p>
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
	</section>
</div>

<style>
	.topbox {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.5rem 1.75rem;
		overflow: hidden;
		background:
			radial-gradient(ellipse 60% 80% at 100% 50%, rgba(74, 158, 107, 0.08), transparent 70%),
			var(--surface);
	}
	.numbers {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 0;
	}
	.big {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.ticker-num {
		font-family: var(--font-serif);
		font-size: 3rem;
		line-height: 1;
		color: var(--text);
		text-shadow: var(--glow-green);
	}
	.lbl {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.facts {
		display: flex;
		gap: 1.5rem;
	}
	.fact {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.fact b {
		font-family: var(--font-serif);
		font-size: 1.35rem;
		font-weight: 400;
	}
	.fact span {
		font-size: 0.66rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.dist-box {
		width: 250px;
		max-width: 100%;
		padding: 0.6rem 0.7rem 0.45rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: rgba(10, 15, 11, 0.5);
	}
	.dist-wrap {
		position: relative;
		padding-top: 1.1rem;
	}
	.avg-mark {
		position: absolute;
		top: 0.9rem;
		bottom: 0;
		width: 1px;
		background: var(--accent);
		box-shadow: var(--glow-green);
		transform: translateX(-50%);
	}
	.avg-tag {
		position: absolute;
		top: -1.05rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.62rem;
		color: var(--accent);
		white-space: nowrap;
		letter-spacing: 0.04em;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 0.3rem;
	}
	.section.first {
		margin-top: 2rem;
	}
	.friend-pick .who {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		margin-top: 0.3rem;
	}
	.friend-pick .w {
		display: inline-flex;
	}
	.artists {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.9rem;
	}
	.artist {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.3rem;
		min-width: 0;
	}
	.artist .cover {
		width: 80px;
		height: 80px;
	}
	.artist .name {
		font-size: 0.85rem;
		font-weight: 500;
		max-width: 100%;
	}
	.artist:hover .name {
		color: var(--accent);
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
	@media (max-width: 680px) {
		.topbox {
			flex-direction: column;
			align-items: stretch;
			padding: 1.25rem;
		}
		.topbox :global(.crate) {
			align-self: center;
		}
		.ticker-num {
			font-size: 2.5rem;
		}
	}
</style>
