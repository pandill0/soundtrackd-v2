<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import Picker from '$lib/components/Picker.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { supporterAccent } from '$lib/entitlements';
	import { formatAvg } from '$lib/stars';
	import type { CatalogItem, FavoriteAlbum, FavoriteArtist } from '$lib/types';
	import { coverSize, formatDate, timeAgo } from '$lib/utils';

	let { data, form } = $props();
	const m = $derived(data.member);
	const accent = $derived(supporterAccent(m));
	const s = $derived(data.stats);
	const dist = $derived((s.distribution ?? []).map((d) => ({ bucket: Number(d.bucket), n: Number(d.n) })));
	const tabHref = (tab: string) => `/profile/${encodeURIComponent(m.username)}${tab === 'reviews' ? '' : `?tab=${tab}`}`;

	// ── Favourites: shown to everyone, edited inline by the owner. Array order is the rank. ──
	type Kind = 'album' | 'artist';
	// svelte-ignore state_referenced_locally
	let favAlbums = $state<(FavoriteAlbum | null)[]>([0, 1, 2, 3].map((i) => data.favAlbums[i] ?? null));
	// svelte-ignore state_referenced_locally
	let favArtists = $state<(FavoriteArtist | null)[]>([0, 1, 2, 3].map((i) => data.favArtists[i] ?? null));
	let editing = $state(false);
	let picking = $state<{ kind: Kind; slot: number } | null>(null);
	let favForm: HTMLFormElement | undefined = $state();
	let saving = $state(false);

	$effect(() => {
		// keep local copies in sync after a save/refresh
		favAlbums = [0, 1, 2, 3].map((i) => data.favAlbums[i] ?? null);
		favArtists = [0, 1, 2, 3].map((i) => data.favArtists[i] ?? null);
	});

	const compact = <T,>(arr: (T | null)[]) => [...arr.filter(Boolean), ...Array(4).fill(null)].slice(0, 4) as (T | null)[];
	async function save() {
		saving = true;
		await tick(); // let the hidden fields pick up the new arrays before the browser reads them
		favForm?.requestSubmit();
	}
	function picked(item: CatalogItem) {
		if (!picking) return;
		if (picking.kind === 'album') {
			favAlbums[picking.slot] = { id: item.id, catalogId: item.id, name: item.title, artist: item.artist_name ?? '', cover: item.cover_url ?? '' };
			favAlbums = compact(favAlbums);
		} else {
			favArtists[picking.slot] = { id: item.id, catalogId: item.id, name: item.title, picture: item.cover_url ?? '' };
			favArtists = compact(favArtists);
		}
		picking = null;
		save();
	}
	function move(kind: Kind, i: number, d: number) {
		const arr = kind === 'album' ? favAlbums : favArtists;
		const j = i + d;
		if (j < 0 || j > 3 || !arr[j]) return;
		[arr[i], arr[j]] = [arr[j], arr[i]];
		save();
	}
	function remove(kind: Kind, i: number) {
		if (kind === 'album') favAlbums = compact(favAlbums.map((f, k) => (k === i ? null : f)));
		else favArtists = compact(favArtists.map((f, k) => (k === i ? null : f)));
		save();
	}
	const albumHref = (f: FavoriteAlbum) => (f.catalogId && data.favMap[f.catalogId] ? `/album/${f.catalogId}` : `/search?q=${encodeURIComponent(`${f.artist} ${f.name}`)}`);
	const artistHref = (f: FavoriteArtist) => (f.catalogId && data.favMap[f.catalogId] ? `/artist/${f.catalogId}` : `/search?q=${encodeURIComponent(f.name)}&kind=artist`);
	const hasFavs = $derived(favAlbums.some(Boolean) || favArtists.some(Boolean));
</script>

<svelte:head>
	<title>{m.username} · Soundtrackd</title>
</svelte:head>

<div class="container page profile">
	<!-- ── Header ─────────────────────────────────────────────── -->
	<header class="head">
		<Avatar profile={m} size={112} link={false} />
		<div class="who">
			<div class="name-row">
				<h1 style={accent ? `color:${accent}` : ''}>{m.username}</h1>
				<SupporterBadge profile={m} />
				{#if m.pronouns}<span class="muted small">{m.pronouns}</span>{/if}
				{#if !data.own}
					{#if data.friend}<span class="tag accent">Friends</span>{:else if data.followsMe}<span class="tag">Follows you</span>{/if}
				{/if}
			</div>
			{#if data.status}
				<div class="status">{#if data.status.emoji}<span>{data.status.emoji}</span>{/if}{data.status.text}</div>
			{/if}
			{#if data.nowPlaying}
				<a class="now-playing" href={data.nowPlaying.kind === 'album' ? `/album/${data.nowPlaying.id}` : `/song/${data.nowPlaying.id}`}>
					<span class="disc" aria-hidden="true"></span>
					<span class="muted tiny">Now playing</span>
					{#if data.nowPlaying.cover_url}<img src={coverSize(data.nowPlaying.cover_url, 56)} alt="" width="22" height="22" />{/if}
					<span class="truncate">{data.nowPlaying.title}{#if data.nowPlaying.artist_name}<span class="muted"> · {data.nowPlaying.artist_name}</span>{/if}</span>
				</a>
			{/if}
			{#if m.bio}<p class="bio prose">{m.bio}</p>{/if}
			<div class="muted tiny meta">
				{#if m.website}<a class="link" href={m.website.startsWith('http') ? m.website : `https://${m.website}`} rel="noopener nofollow" target="_blank">{m.website.replace(/^https?:\/\//, '')}</a> · {/if}
				Joined {formatDate(m.created_at, { month: 'short', day: undefined })}
				{#if m.last_seen_at && !data.own} · Seen {timeAgo(m.last_seen_at)}{/if}
			</div>
		</div>
		<div class="actions">
			{#if data.own}
				<a class="btn" href="/settings">Edit profile</a>
			{:else if !page.data.user}
				<a class="btn btn-primary" href="/login?next={encodeURIComponent(page.url.pathname)}">Follow</a>
			{:else if !data.blockedByThem}
				{#if data.friend}<a class="btn btn-primary" href="/messages/new?to={m.id}">Message</a>{/if}
				<FollowButton userId={m.id} following={data.following} followsMe={data.followsMe} blockedByMe={data.blockedByMe} />
			{/if}
		</div>
	</header>

	<!-- ── Stats ──────────────────────────────────────────────── -->
	<div class="stats">
		<a class="stat" href={tabHref('reviews')}><b>{s.ratings ?? 0}</b><span>ratings</span></a>
		<a class="stat" href="{tabHref('reviews')}?reviewed=yes"><b>{s.reviews ?? 0}</b><span>reviews</span></a>
		<a class="stat" href={tabHref('lists')}><b>{s.lists ?? 0}</b><span>lists</span></a>
		<a class="stat" href="/profile/{encodeURIComponent(m.username)}/followers"><b>{s.followers ?? 0}</b><span>followers</span></a>
		<a class="stat" href="/profile/{encodeURIComponent(m.username)}/following"><b>{s.following ?? 0}</b><span>following</span></a>
		<span class="stat" title="Mutual follows"><b>{s.friends ?? 0}</b><span>friends</span></span>
		<span class="stat"><b class="gold">{s.avg_rating != null ? formatAvg(Number(s.avg_rating)) : '–'}</b><span>avg rating</span></span>
		{#if dist.some((d) => d.n)}<span class="stat dist"><RatingDistribution buckets={dist} compact /><span>distribution</span></span>{/if}
	</div>

	<!-- ── Favourites ─────────────────────────────────────────── -->
	{#if hasFavs || data.own}
		<section class="favs">
			<form method="POST" action="?/favorites" bind:this={favForm} use:enhance={() => async ({ update }) => { saving = false; await update({ reset: false }); }} hidden>
				<input type="hidden" name="favorite_albums" value={JSON.stringify(favAlbums.filter(Boolean))} />
				<input type="hidden" name="favorite_artists" value={JSON.stringify(favArtists.filter(Boolean))} />
			</form>
			<div class="favs-head">
				<span class="eyebrow">Favourites</span>
				{#if data.own && (hasFavs || editing)}
					<span class="row">
						{#if saving}<span class="muted tiny">Saving…</span>{/if}
						{#if form?.error}<span class="error-msg tiny">{form.error}</span>{/if}
						<button class="btn btn-xs" class:active={editing} onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button>
					</span>
				{/if}
			</div>
			{#if !hasFavs && !editing}
				<div class="empty favs-empty">
					Show people your taste: four favourite albums and four favourite artists.
					<br /><button class="btn btn-sm btn-primary" onclick={() => (editing = true)}>Pick your favourites</button>
				</div>
			{:else}
				<div class="fav-groups">
					{#each [{ kind: 'album', label: 'Albums', list: favAlbums }, { kind: 'artist', label: 'Artists', list: favArtists }] as g (g.kind)}
						{#if g.list.some(Boolean) || editing}
							<div class="fav-group">
								<div class="muted tiny group-label">{g.label}</div>
								<ol class="fav-row" class:artists={g.kind === 'artist'}>
									{#each [0, 1, 2, 3] as i (i)}
										{@const f = g.list[i]}
										{#if f}
											{@const item = f.catalogId ? data.favMap[f.catalogId] : null}
											{@const href = g.kind === 'album' ? albumHref(f as FavoriteAlbum) : artistHref(f as FavoriteArtist)}
											{@const img = item?.cover_url ?? (g.kind === 'album' ? (f as FavoriteAlbum).cover : (f as FavoriteArtist).picture)}
											<li class="fav">
												<a {href} class="fav-img" title={f.name}>
													<img class="cover" class:round={g.kind === 'artist'} src={coverSize(img, 250) ?? img} alt="" loading="lazy" />
													<span class="rank" aria-label="Rank {i + 1}">{i + 1}</span>
												</a>
												<a {href} class="fav-name truncate">{f.name}</a>
												{#if g.kind === 'album'}<div class="fav-sub muted truncate">{(f as FavoriteAlbum).artist}</div>{/if}
												{#if editing}
													<div class="ctl">
														<button class="btn btn-xs btn-ghost" onclick={() => move(g.kind as Kind, i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">◀</button>
														<button class="btn btn-xs btn-ghost" onclick={() => (picking = { kind: g.kind as Kind, slot: i })} aria-label="Replace" title="Replace">↻</button>
														<button class="btn btn-xs btn-ghost" onclick={() => move(g.kind as Kind, i, 1)} disabled={i === 3 || !g.list[i + 1]} aria-label="Move down" title="Move down">▶</button>
														<button class="btn btn-xs btn-danger" onclick={() => remove(g.kind as Kind, i)} aria-label="Remove" title="Remove">✕</button>
													</div>
												{/if}
											</li>
										{:else if editing}
											<li class="fav empty">
												<button class="fav-img add" class:round={g.kind === 'artist'} onclick={() => (picking = { kind: g.kind as Kind, slot: i })} title="Add a favourite {g.kind}">+</button>
												<span class="fav-name muted">Add {g.kind}</span>
											</li>
										{/if}
									{/each}
								</ol>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- ── Tabs ───────────────────────────────────────────────── -->
	<nav class="tabs" aria-label="Profile sections">
		<a class="tab" class:active={data.tab === 'reviews'} href={tabHref('reviews')}>Ratings & reviews</a>
		<a class="tab" class:active={data.tab === 'lists'} href={tabHref('lists')}>Lists</a>
		{#if data.canSeeQueue}<a class="tab" class:active={data.tab === 'queue'} href={tabHref('queue')}>Listen queue</a>{/if}
	</nav>

	{#if data.tab === 'reviews'}
		<SortBar
			sorts={[{ value: 'date', label: 'Date rated' }, { value: 'rating', label: 'Rating' }, { value: 'year', label: 'Release year' }, { value: 'artist', label: 'Artist' }, { value: 'title', label: 'Title' }]}
			defaultSort="date"
			filters={[
				{ key: 'min', label: 'Rating', options: [{ value: '4.5', label: '4½+' }, { value: '4', label: '4+' }, { value: '3', label: '3+' }, { value: '2', label: '2+' }] },
				{ key: 'reviewed', label: 'Reviewed', options: [{ value: 'yes', label: 'With review' }, { value: 'no', label: 'Rating only' }] },
				{ key: 'genre', label: 'Genre', options: data.genres.map((g) => ({ value: g, label: g })) }
			]}
		/>
		{#if data.ratings.length}
			<div class="ratings">
				{#each data.ratings as r (r.id)}
					{#if r.review}
						<ReviewCard
							review={{ id: String(r.id), user_id: m.id, username: m.username, avatar_url: m.avatar_url, accent_color: m.accent_color, supporter_until: m.supporter_until, rating: Number(r.rating), review: String(r.review), created_at: String(r.created_at), like_count: Number(r.like_count ?? 0) }}
							about={{ title: String(r.title ?? ''), subtitle: r.artist_name as string | null, cover: r.cover_url as string | null, href: r.catalog_item_id ? `/album/${r.catalog_item_id}` : `/search?q=${encodeURIComponent(String(r.title ?? ''))}` }}
						/>
					{:else}
						<a class="list-row rating-row" href={r.catalog_item_id ? `/album/${r.catalog_item_id}` : `/search?q=${encodeURIComponent(String(r.title ?? ''))}`}>
							{#if r.cover_url}<img class="thumb" src={coverSize(String(r.cover_url), 120)} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}
							<span class="grow truncate"><span class="t">{r.title}</span><span class="muted small">{[r.artist_name, r.release_year].filter(Boolean).join(' · ')}</span></span>
							<Stars value={Number(r.rating)} size="0.85rem" />
							<span class="muted tiny when">{timeAgo(String(r.created_at))}</span>
						</a>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="empty">{data.own ? "You haven't rated anything yet." : `${m.username} hasn't rated anything yet.`}{#if data.own}<br /><a class="btn btn-sm btn-primary" href="/search">Find something to rate</a>{/if}</div>
		{/if}
	{:else if data.tab === 'lists'}
		{#if data.lists.length}
			<div class="stack">
				{#each data.lists as l (l.id)}
					<a class="card tight list-card" href="/list/{l.id}">
						<div class="covers">{#each (l.items as { cover?: string }[]).slice(0, 4) as it, i (i)}<img src={coverSize(it.cover, 120) ?? it.cover} alt="" loading="lazy" />{/each}</div>
						<div class="grow">
							<div class="t">{l.title}</div>
							<div class="muted small">{l.item_count} {l.type === 'songs' ? 'songs' : l.type === 'mixed' ? 'items' : 'albums'} · updated {timeAgo(String(l.updated_at))}{#if Number(l.like_count)} · ♥ {l.like_count}{/if}</div>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="empty">No lists yet.{#if data.own}<br /><a class="btn btn-sm btn-primary" href="/lists?new=1">Start one</a>{/if}</div>
		{/if}
	{:else}
		<SortBar
			sorts={[{ value: 'added', label: 'Date added' }, { value: 'year', label: 'Release year' }, { value: 'artist', label: 'Artist' }, { value: 'rating', label: 'Community rating' }]}
			defaultSort="added"
			filters={[{ key: 'genre', label: 'Genre', options: data.genres.map((g) => ({ value: g, label: g })) }]}
		/>
		{#if data.queue.length}
			<div class="album-grid">
				{#each data.queue as q (q.catalog_item_id)}
					<AlbumCard item={{ id: String(q.catalog_item_id), kind: 'album', title: String(q.title), artist_name: q.artist_name as string | null, cover_url: q.cover_url as string | null, release_year: q.release_year as number | null, artist_id: null, parent_id: null, mbid: null, release_date: null, genres: [], record_type: null, duration_ms: null, position: null, label: null, track_count: null, fetched_at: '' }} stats={{ avg_rating: q.avg_rating as number | null, rating_count: Number(q.rating_count) }} />
				{/each}
			</div>
		{:else}
			<div class="empty">The queue is empty.</div>
		{/if}
	{/if}
</div>

{#if picking}
	<Picker kind={picking.kind} title={picking.kind === 'album' ? 'Pick a favourite album' : 'Pick a favourite artist'} onpick={picked} onclose={() => (picking = null)} />
{/if}

<style>
	.head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 1.5rem;
		align-items: start;
		margin-bottom: 1.25rem;
	}
	.who {
		min-width: 0;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.name-row h1 {
		font-size: 2.1rem;
		text-shadow: var(--glow-green);
		line-height: 1.1;
	}
	.status {
		margin-top: 0.4rem;
		font-size: 0.95rem;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.now-playing {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.5rem;
		padding: 0.3rem 0.6rem 0.3rem 0.4rem;
		border-radius: 999px;
		background: var(--surface2);
		font-size: 0.85rem;
		max-width: 100%;
	}
	.now-playing img {
		width: 22px;
		height: 22px;
		border-radius: 4px;
	}
	.disc {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--star) 0 22%, #111 24% 100%);
		animation: spin 2.4s linear infinite;
		flex-shrink: 0;
	}
	.bio {
		margin-top: 0.6rem;
		max-width: 60ch;
	}
	.meta {
		margin-top: 0.5rem;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.75rem;
		padding: 1rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}
	.stat {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.stat b {
		font-family: var(--font-serif);
		font-size: 1.3rem;
		font-weight: 400;
	}
	.stat span {
		font-size: 0.7rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	a.stat:hover b {
		color: var(--accent);
	}
	.stat.dist {
		min-width: 90px;
	}

	.favs {
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--border);
		margin-bottom: 1.25rem;
	}
	.favs-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.favs-empty {
		padding: 1.5rem 1rem;
	}
	.fav-groups {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
	.group-label {
		margin-bottom: 0.4rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.fav-row {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.fav {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.fav-img {
		position: relative;
		display: block;
		aspect-ratio: 1;
	}
	.fav-img .cover {
		width: 100%;
		height: 100%;
	}
	.rank {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: rgba(10, 15, 11, 0.85);
		color: var(--star);
		font-size: 0.65rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.artists .rank {
		top: 0;
		left: 0;
	}
	.fav-name {
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.25;
	}
	.fav-name:hover {
		color: var(--accent);
	}
	.artists .fav-name {
		text-align: center;
	}
	.fav-sub {
		font-size: 0.72rem;
	}
	.fav-img.add {
		width: 100%;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--muted);
		font-size: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.fav-img.add:hover {
		color: var(--accent);
		border-color: rgba(74, 158, 107, 0.5);
	}
	.fav-img.add.round {
		border-radius: 50%;
	}
	.ctl {
		display: flex;
		gap: 2px;
		justify-content: center;
	}
	.ctl .btn {
		padding: 0.15rem 0.35rem;
	}

	.ratings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.rating-row {
		padding: 0.55rem 0.4rem;
		border-radius: var(--radius-sm);
	}
	.rating-row:hover {
		background: var(--surface);
	}
	.rating-row .t {
		display: block;
		font-size: 0.92rem;
	}
	.when {
		min-width: 4rem;
		text-align: right;
	}
	.list-card {
		display: flex;
		gap: 0.9rem;
		align-items: center;
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

	@media (max-width: 680px) {
		.head {
			grid-template-columns: auto minmax(0, 1fr);
			gap: 1rem;
		}
		.head :global(.avatar) {
			width: 80px !important;
			height: 80px !important;
			font-size: 34px !important;
		}
		.actions {
			grid-column: 1 / -1;
			justify-content: flex-start;
		}
		.fav-groups {
			grid-template-columns: 1fr;
		}
		.when {
			display: none;
		}
		.name-row h1 {
			font-size: 1.7rem;
		}
	}
</style>
