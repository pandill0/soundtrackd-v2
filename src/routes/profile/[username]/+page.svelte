<script lang="ts">
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import FriendButton from '$lib/components/FriendButton.svelte';
	import RatingDistribution from '$lib/components/RatingDistribution.svelte';
	import ReviewCard from '$lib/components/ReviewCard.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import Stars from '$lib/components/Stars.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { supporterAccent } from '$lib/entitlements';
	import { formatAvg } from '$lib/stars';
	import { formatDate, timeAgo } from '$lib/utils';

	let { data } = $props();
	const p = $derived(data.profile);
	const accent = $derived(supporterAccent(p));
	const tabHref = (tab: string) => `/profile/${encodeURIComponent(p.username)}${tab === 'reviews' ? '' : `?tab=${tab}`}`;
	const s = $derived(data.stats);
	const dist = $derived((s.distribution ?? []).map((d) => ({ bucket: Number(d.bucket), n: Number(d.n) })));
</script>

<svelte:head>
	<title>{p.username} · Soundtrackd</title>
</svelte:head>

<div class="container page profile" style={accent ? `--accent-user:${accent}` : ''}>
	<header class="head">
		<Avatar profile={p} size={96} link={false} />
		<div class="grow">
			<div class="name-row">
				<h1 style={accent ? `color:${accent}` : ''}>{p.username}</h1>
				<SupporterBadge profile={p} />
				{#if p.pronouns}<span class="muted small">{p.pronouns}</span>{/if}
			</div>
			{#if data.status}
				<div class="status">{#if data.status.emoji}<span>{data.status.emoji}</span>{/if}{data.status.text}</div>
			{/if}
			{#if data.nowPlaying}
				<a class="now-playing" href={data.nowPlaying.kind === 'album' ? `/album/${data.nowPlaying.id}` : `/song/${data.nowPlaying.id}`}>
					<span class="disc" aria-hidden="true"></span>
					<span class="muted tiny">Now playing</span>
					{#if data.nowPlaying.cover_url}<img src={data.nowPlaying.cover_url} alt="" width="22" height="22" />{/if}
					<span class="truncate">{data.nowPlaying.title}{#if data.nowPlaying.artist_name}<span class="muted"> · {data.nowPlaying.artist_name}</span>{/if}</span>
				</a>
			{/if}
			{#if p.bio}<p class="bio prose">{p.bio}</p>{/if}
			<div class="muted tiny meta">
				{#if p.website}<a class="link" href={p.website.startsWith('http') ? p.website : `https://${p.website}`} rel="noopener nofollow" target="_blank">{p.website.replace(/^https?:\/\//, '')}</a> · {/if}
				Joined {formatDate(p.created_at, { month: 'short', day: undefined })}
				{#if p.last_seen_at && !data.own} · Seen {timeAgo(p.last_seen_at)}{/if}
			</div>
		</div>
		<div class="actions">
			{#if data.own}
				<a class="btn" href="/settings">Edit profile</a>
			{:else if page.data.user}
				<FollowButton userId={p.id} following={data.following} />
				<FriendButton userId={p.id} friendship={data.friendship} />
			{:else}
				<a class="btn btn-primary" href="/login?next={encodeURIComponent(page.url.pathname)}">Follow</a>
			{/if}
		</div>
	</header>

	<div class="stats">
		<a class="stat" href={tabHref('reviews')}><b>{s.ratings ?? 0}</b><span>ratings</span></a>
		<a class="stat" href={tabHref('reviews') + (tabHref('reviews').includes('?') ? '&' : '?') + 'reviewed=yes'}><b>{s.reviews ?? 0}</b><span>reviews</span></a>
		<a class="stat" href={tabHref('lists')}><b>{s.lists ?? 0}</b><span>lists</span></a>
		<a class="stat" href="/profile/{encodeURIComponent(p.username)}/followers"><b>{s.followers ?? 0}</b><span>followers</span></a>
		<a class="stat" href="/profile/{encodeURIComponent(p.username)}/following"><b>{s.following ?? 0}</b><span>following</span></a>
		<span class="stat"><b>{s.friends ?? 0}</b><span>friends</span></span>
		<span class="stat"><b class="gold">{s.avg_rating != null ? formatAvg(Number(s.avg_rating)) : '–'}</b><span>avg rating</span></span>
		{#if dist.some((d) => d.n)}<span class="stat dist"><RatingDistribution buckets={dist} compact /><span>distribution</span></span>{/if}
	</div>

	{#if data.favAlbums.some(Boolean) || data.favArtists.some(Boolean) || data.own}
		<section class="section favs">
			{#if data.favAlbums.some(Boolean) || data.own}
				<div class="fav-group">
					<div class="eyebrow">Favourite albums</div>
					<div class="fav-row">
						{#each [0, 1, 2, 3] as i (i)}
							{@const f = data.favAlbums[i]}
							{@const item = f?.catalogId ? data.favMap[f.catalogId] : null}
							{#if f}
								<a class="fav" href={item ? `/album/${item.id}` : `/search?q=${encodeURIComponent(`${f.artist} ${f.name}`)}`} title="{f.name} — {f.artist}">
									<img class="cover" src={item?.cover_url ?? f.cover} alt={f.name} loading="lazy" />
								</a>
							{:else if data.own}
								<a class="fav empty-slot" href="/settings#favorites" title="Add a favourite">+</a>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
			{#if data.favArtists.some(Boolean) || data.own}
				<div class="fav-group">
					<div class="eyebrow">Favourite artists</div>
					<div class="fav-row">
						{#each [0, 1, 2, 3] as i (i)}
							{@const f = data.favArtists[i]}
							{@const item = f?.catalogId ? data.favMap[f.catalogId] : null}
							{#if f}
								<a class="fav" href={item ? `/artist/${item.id}` : `/search?q=${encodeURIComponent(f.name)}&kind=artist`} title={f.name}>
									<img class="cover round" src={item?.cover_url ?? f.picture} alt={f.name} loading="lazy" />
								</a>
							{:else if data.own}
								<a class="fav empty-slot round" href="/settings#favorites" title="Add a favourite">+</a>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

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
							review={{ id: String(r.id), user_id: p.id, username: p.username, avatar_url: p.avatar_url, accent_color: p.accent_color, supporter_until: p.supporter_until, rating: Number(r.rating), review: String(r.review), created_at: String(r.created_at), like_count: Number(r.like_count ?? 0) }}
							about={{ title: String(r.title ?? ''), subtitle: r.artist_name as string | null, cover: r.cover_url as string | null, href: r.catalog_item_id ? `/album/${r.catalog_item_id}` : `/search?q=${encodeURIComponent(String(r.title ?? ''))}` }}
						/>
					{:else}
						<a class="list-row rating-row" href={r.catalog_item_id ? `/album/${r.catalog_item_id}` : `/search?q=${encodeURIComponent(String(r.title ?? ''))}`}>
							{#if r.cover_url}<img class="thumb" src={String(r.cover_url)} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}
							<span class="grow truncate"><span class="t">{r.title}</span><span class="muted small">{[r.artist_name, r.release_year].filter(Boolean).join(' · ')}</span></span>
							<Stars value={Number(r.rating)} size="0.85rem" />
							<span class="muted tiny when">{timeAgo(String(r.created_at))}</span>
						</a>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="empty">{data.own ? "You haven't rated anything yet." : `${p.username} hasn't rated anything yet.`}{#if data.own}<br /><a class="btn btn-sm btn-primary" href="/search">Find something to rate</a>{/if}</div>
		{/if}
	{:else if data.tab === 'lists'}
		{#if data.lists.length}
			<div class="stack">
				{#each data.lists as l (l.id)}
					<a class="card tight list-card" href="/list/{l.id}">
						<div class="covers">{#each (l.items as { cover?: string }[]).slice(0, 4) as it, i (i)}<img src={it.cover} alt="" loading="lazy" />{/each}</div>
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

<style>
	.head {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.name-row h1 {
		font-size: 2rem;
		text-shadow: var(--glow-green);
	}
	.status {
		margin-top: 0.3rem;
		font-size: 0.95rem;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.now-playing {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.4rem;
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
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem 1.75rem;
		padding: 1rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		margin-bottom: 1.5rem;
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
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		margin: 0 0 1.5rem;
	}
	.fav-row {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.4rem;
	}
	.fav {
		width: 72px;
		height: 72px;
	}
	.fav .cover {
		width: 72px;
		height: 72px;
	}
	.empty-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--muted);
		font-size: 1.3rem;
	}
	.empty-slot.round {
		border-radius: 50%;
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
	@media (max-width: 580px) {
		.head {
			flex-wrap: wrap;
		}
		.actions {
			width: 100%;
			justify-content: flex-start;
		}
		.when {
			display: none;
		}
	}
</style>
