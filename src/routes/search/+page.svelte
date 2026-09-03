<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import QueueButton from '$lib/components/QueueButton.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import { formatAvg, starString } from '$lib/stars';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let q = $state(data.q);
	const kinds = [['all', 'Everything'], ['album', 'Albums'], ['track', 'Songs'], ['artist', 'Artists']] as const;

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const url = new URL(page.url);
		url.searchParams.set('q', q.trim());
		goto(url);
	}
	function kindHref(k: string) {
		const url = new URL(page.url);
		if (k === 'all') url.searchParams.delete('kind');
		else url.searchParams.set('kind', k);
		return url.pathname + url.search;
	}
</script>

<svelte:head><title>{data.q ? `${data.q} · Search` : 'Search'} · Soundtrackd</title></svelte:head>

<div class="container page">
	<form class="searchbar" onsubmit={submit} role="search">
		<!-- svelte-ignore a11y_autofocus -->
		<input class="input big" type="search" placeholder="Albums, songs, artists, members…" bind:value={q} autofocus={!data.q} autocomplete="off" />
		<button class="btn btn-primary" type="submit">Search</button>
	</form>
	<nav class="tabs" aria-label="Type">
		{#each kinds as [k, label] (k)}<a class="tab" class:active={data.kind === k} href={kindHref(k)}>{label}</a>{/each}
	</nav>

	{#if !data.results}
		<div class="empty">Type at least two characters.</div>
	{:else}
		<SortBar
			sorts={[{ value: 'relevance', label: 'Relevance' }, { value: 'year', label: 'Release year' }, { value: 'rating', label: 'Community rating' }]}
			defaultSort="relevance"
			filters={[
				{ key: 'genre', label: 'Genre', options: data.genres.map((g) => ({ value: g, label: g })) },
				{ key: 'decade', label: 'Decade', options: data.decades.map((d) => ({ value: String(d), label: `${d}s` })) }
			]}
		/>

		{#if data.members.length}
			<section class="section first">
				<h2 class="section-title">Members</h2>
				<div class="members">
					{#each data.members as m (m.id)}
						<a class="member" href="/profile/{encodeURIComponent(m.username)}"><Avatar profile={m} size={32} link={false} /> {m.username} <span class="muted tiny">{m.review_count} ratings</span></a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.results.albums.length}
			<section class="section" class:first={!data.members.length}>
				<h2 class="section-title">Albums</h2>
				<div class="album-grid">
					{#each data.results.albums as a (a.id)}
						<div class="with-queue">
							<AlbumCard item={a} stats={data.stats[a.id]} />
							<span class="qbtn"><QueueButton itemId={a.id} inQueue={data.queued.includes(a.id)} compact /></span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.results.tracks.length}
			<section class="section">
				<h2 class="section-title">Songs</h2>
				<div class="list">
					{#each data.results.tracks as t (t.id)}
						{@const s = data.trackStats[t.id]}
						<a class="list-row" href="/song/{t.id}">
							{#if t.cover_url}<img class="thumb" src={t.cover_url} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}
							<span class="grow truncate"><span class="t">{t.title}</span><span class="muted small">{t.artist_name}</span></span>
							{#if s?.my_rating}<span class="accent small">{starString(Number(s.my_rating))}</span>{/if}
							{#if s?.rating_count}<span class="gold small">★ {formatAvg(s.avg_rating)} <span class="muted">{s.rating_count}</span></span>{/if}
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.results.artists.length}
			<section class="section">
				<h2 class="section-title">Artists</h2>
				<div class="album-grid small">
					{#each data.results.artists as ar (ar.id)}<AlbumCard item={ar} showArtist={false} />{/each}
				</div>
			</section>
		{/if}

		{#if !data.results.albums.length && !data.results.tracks.length && !data.results.artists.length && !data.members.length}
			<div class="empty">Nothing found for “{data.q}”.</div>
		{/if}
	{/if}
</div>

<style>
	.searchbar {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.input.big {
		font-size: 1.1rem;
		padding: 0.8rem 1rem;
	}
	.section.first {
		margin-top: 0;
	}
	.members {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.member {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.8rem 0.35rem 0.4rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.9rem;
	}
	.with-queue {
		position: relative;
	}
	.qbtn {
		position: absolute;
		top: 6px;
		right: 6px;
	}
	.t {
		display: block;
	}
</style>
