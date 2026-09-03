<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import FeedItem from '$lib/components/FeedItem.svelte';
	import Picker from '$lib/components/Picker.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import { openRateModal } from '$lib/rate-modal.svelte';
	import { formatAvg } from '$lib/stars';
	import type { CatalogItem, FeedEvent } from '$lib/types';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
	const profile = $derived(page.data.profile ?? { username: 'there', status_text: null, status_emoji: null, now_playing_id: null });
	const hour = new Date().getHours();
	const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

	let statusText = $state('');
	let statusOpen = $state(false);
	let picking = $state(false);
	const dist = $derived((data.stats.distribution ?? []).map((d) => ({ bucket: Number(d.bucket), n: Number(d.n) })));
	const asItem = (r: Record<string, unknown>, id = 'id'): CatalogItem => ({ id: String(r[id]), kind: 'album', title: String(r.title), artist_name: (r.artist_name as string | null) ?? null, cover_url: (r.cover_url as string | null) ?? null, release_year: (r.release_year as number | null) ?? null, artist_id: (r.artist_id as string | null) ?? null, parent_id: null, mbid: null, release_date: null, genres: [], record_type: (r.record_type as string | null) ?? null, duration_ms: null, position: null, label: null, track_count: null, fetched_at: '' });

	async function saveStatus() {
		await fetch('/api/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: statusText, expiresHours: 24 }) });
		statusOpen = false;
		await invalidateAll();
	}
	async function nowSpinning(item: CatalogItem) {
		picking = false;
		await fetch('/api/now-playing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
		await invalidateAll();
	}
</script>

<svelte:head><title>Home · Soundtrackd</title></svelte:head>

<div class="container page dash">
	<header class="greet">
		<div class="grow">
			<h1>{greeting}, <span class="accent">{profile.username}</span>.</h1>
			<div class="row quick">
				{#if statusOpen}
					<form class="row" onsubmit={(e) => { e.preventDefault(); saveStatus(); }}>
						<!-- svelte-ignore a11y_autofocus -->
						<input class="input" placeholder="What are you into right now?" bind:value={statusText} maxlength="140" autofocus />
						<button class="btn btn-sm btn-primary" type="submit">Set</button>
						<button class="btn btn-sm btn-ghost" type="button" onclick={() => (statusOpen = false)}>Cancel</button>
					</form>
				{:else}
					<button class="chip" onclick={() => { statusText = profile.status_text ?? ''; statusOpen = true; }}>{profile.status_text ? `${profile.status_emoji ?? ''} ${profile.status_text}` : '+ set a status'}</button>
					<button class="chip" onclick={() => (picking = true)}><span class="disc" class:spin={!!profile.now_playing_id}></span>{profile.now_playing_id ? 'now spinning · change' : 'now spinning?'}</button>
				{/if}
			</div>
		</div>
		<a class="btn btn-primary btn-sm" href="/search">+ Log a record</a>
	</header>

	<div class="cols">
		<main class="main">
			<section class="section first">
				<div class="section-head"><h2 class="section-title">From people you follow</h2><a class="more" href="/members">Find more people →</a></div>
				{#if data.feed.length}
					<div class="feed">
						{#each data.feed as ev (ev.kind + String(ev.id))}
							<FeedItem event={ev as unknown as FeedEvent} />
						{/each}
					</div>
				{:else}
					<div class="empty">
						Your feed is quiet. Follow a few members and their ratings, reviews and lists show up here.
						<br /><a class="btn btn-sm btn-primary" href="/members">Browse members</a>
					</div>
				{/if}
			</section>

			{#if data.releases.length}
				<section class="section">
					<div class="section-head"><h2 class="section-title">New from artists you rate highly</h2></div>
					<div class="album-grid small">
						{#each data.releases as r (r.id)}<AlbumCard item={asItem(r)} subtitle={r.release_date ? timeAgo(String(r.release_date)) : ''} />{/each}
					</div>
				</section>
			{/if}

			<section class="section">
				<div class="section-head"><h2 class="section-title">Community</h2><a class="more" href="/charts">Charts →</a></div>
				{#if data.week.length}
					<div class="eyebrow">Most rated this week</div>
					<div class="album-grid small">
						{#each data.week as a (a.id)}<AlbumCard item={asItem(a)} stats={{ avg_rating: a.avg_rating as number | null, rating_count: Number(a.rating_count) }} />{/each}
					</div>
				{/if}
				{#await data.trending then t}
					{#if t.length}
						<div class="eyebrow" style="margin-top:1.25rem">Trending worldwide</div>
						<div class="album-grid small">{#each t as a (a.id)}<AlbumCard item={a} />{/each}</div>
					{/if}
				{/await}
				{#if data.newLists.length}
					<div class="eyebrow" style="margin-top:1.25rem">New lists</div>
					{#each data.newLists as l (l.id)}
						<a class="list-row" href="/list/{l.id}"><span class="grow truncate">{l.title}</span><span class="muted tiny">{l.username} · {l.item_count} items</span></a>
					{/each}
				{/if}
			</section>
		</main>

		<aside class="aside">
			{#if data.queue.length}
				<div class="card tight module">
					<div class="section-head"><span class="eyebrow">Continue where you left off</span><a class="more" href="/queue">Queue →</a></div>
					{#each data.queue as q (q.catalog_item_id)}
						<div class="list-row q">
							<a href="/album/{q.catalog_item_id}">{#if q.cover_url}<img class="thumb" src={String(q.cover_url)} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}</a>
							<div class="grow truncate"><a class="t truncate" href="/album/{q.catalog_item_id}">{q.title}</a><div class="muted tiny truncate">{q.artist_name}</div></div>
							<button class="btn btn-xs" onclick={() => openRateModal({ kind: 'album', id: String(q.catalog_item_id), title: String(q.title), artist: q.artist_name as string | null, cover: q.cover_url as string | null })}>Rate</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="card tight module">
				<div class="section-head"><span class="eyebrow">Friends</span><a class="more" href="/friends">All →</a></div>
				{#if data.friends.length}
					{#each data.friends.slice(0, 8) as f (f.id)}
						<div class="list-row friend">
							<Avatar profile={{ id: String(f.id), username: String(f.username), avatar_url: f.avatar_url as string | null, accent_color: f.accent_color as string | null, supporter_until: f.supporter_until as string | null }} size={30} />
							<div class="grow truncate">
								<a class="t" href="/profile/{encodeURIComponent(String(f.username))}">{f.username}</a>
								{#if f.np_title}<a class="np truncate" href="/album/{f.now_playing_id}"><span class="disc spin"></span>{f.np_title}</a>{:else if f.status_text}<div class="muted tiny truncate">{f.status_emoji ?? ''} {f.status_text}</div>{:else if f.last_seen_at}<div class="muted tiny">seen {timeAgo(String(f.last_seen_at))}</div>{/if}
							</div>
						</div>
					{/each}
				{:else}
					<p class="muted small">No friends yet — <a class="link" href="/members">find some</a>. Friends can message each other.</p>
				{/if}
			</div>

			{#if data.unreadConvs.length}
				<a class="card tight module msgs" href="/messages">
					<span class="badge">{data.unreadConvs.reduce((s, c) => s + c.unread, 0)}</span>
					<span class="grow"><strong>Unread messages</strong><div class="muted tiny truncate">{data.unreadConvs[0].other_username}: {data.unreadConvs[0].last_body}</div></span>
				</a>
			{/if}

			<div class="card tight module stats">
				<div class="eyebrow">Your stats</div>
				<div class="row nums">
					<div><b>{data.stats.this_month ?? 0}</b><span>this month</span></div>
					<div><b>{data.stats.ratings ?? 0}</b><span>ratings</span></div>
					<div><b class="gold">{data.stats.avg_rating != null ? formatAvg(Number(data.stats.avg_rating)) : '–'}</b><span>avg</span></div>
				</div>
				{#if dist.some((d) => d.n)}<RatingDistribution buckets={dist} compact />{/if}
			</div>
		</aside>
	</div>
</div>

{#if picking}
	<Picker kind="all" title="Now spinning" onpick={nowSpinning} onclose={() => (picking = false)} />
{/if}

<style>
	.greet {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.greet h1 {
		font-size: 1.9rem;
	}
	.quick {
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		background: var(--surface2);
		color: var(--muted);
		font-size: 0.82rem;
	}
	.chip:hover {
		color: var(--text);
	}
	.disc {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--star) 0 22%, #111 24% 100%);
		flex-shrink: 0;
	}
	.disc.spin {
		animation: spin 2.4s linear infinite;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		gap: 2rem;
		align-items: start;
	}
	.section.first {
		margin-top: 0;
	}
	.aside {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.module .section-head {
		margin-bottom: 0.4rem;
	}
	.q .t,
	.friend .t {
		font-size: 0.88rem;
		font-weight: 500;
		display: block;
	}
	.np {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: var(--accent);
	}
	.msgs {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.nums {
		gap: 1.25rem;
		margin: 0.4rem 0 0.6rem;
	}
	.nums div {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.nums b {
		font-family: var(--font-serif);
		font-size: 1.3rem;
		font-weight: 400;
	}
	.nums span {
		font-size: 0.65rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	@media (max-width: 780px) {
		.cols {
			grid-template-columns: 1fr;
		}
		.aside {
			order: -1;
		}
	}
</style>
