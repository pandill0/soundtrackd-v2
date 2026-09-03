<script lang="ts">
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import { openRateModal } from '$lib/rate-modal.svelte';
	import { formatAvg, starString } from '$lib/stars';
	import { formatDuration, plural } from '$lib/utils';

	let { data } = $props();
	const artist = $derived(data.artist);
</script>

<svelte:head>
	<title>{artist.title} · Soundtrackd</title>
</svelte:head>

<div class="artist-hero" style={artist.cover_url ? `--bg:url('${artist.cover_url}')` : ''}>
	<div class="backdrop"></div>
	<div class="container hero-inner">
		{#if artist.cover_url}<img class="portrait" src={artist.cover_url} alt="" width="150" height="150" />{/if}
		<div>
			<div class="eyebrow">Artist</div>
			<h1>{artist.title}</h1>
			<div class="muted small">
				{plural(data.summary.albums, 'release')}
				{#if data.summary.ratings}· {plural(data.summary.ratings, 'rating')} · avg <span class="gold">★ {formatAvg(data.summary.avg)}</span>{/if}
			</div>
			<div class="links tiny">
				{#each data.links as l (l.partner)}
					<a href={l.href} target="_blank" rel={l.sponsored ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}>{l.label}</a>
				{/each}
			</div>
		</div>
	</div>
</div>

<div class="container page">
	{#if data.topTracks.length}
		<section class="section first" aria-labelledby="top">
			<h2 id="top" class="section-title">Top tracks</h2>
			<ol class="top">
				{#each data.topTracks as t, i (t.id)}
					{@const s = data.topStats[t.id]}
					<li class="top-row">
						<span class="muted num">{i + 1}</span>
						{#if t.cover_url}<img class="thumb" src={t.cover_url} alt="" loading="lazy" />{/if}
						<a class="truncate grow" href="/song/{t.id}">{t.title}</a>
						{#if s?.rating_count}<span class="gold small">★ {formatAvg(s.avg_rating)} <span class="muted">{s.rating_count}</span></span>{/if}
						<button class="mine" class:has={s?.my_rating} onclick={() => openRateModal({ kind: 'track', id: t.id, title: t.title, artist: artist.title, cover: t.cover_url, albumId: t.parent_id }, s?.my_rating ? { rating: Number(s.my_rating), review: null } : null)}>
							{s?.my_rating ? starString(Number(s.my_rating)) : '☆'}
						</button>
						<span class="muted tiny dur">{formatDuration(t.duration_ms)}</span>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<section class="section" aria-labelledby="discog">
		<h2 id="discog" class="section-title">Discography</h2>
		<SortBar
			sorts={[{ value: 'year', label: 'Year' }, { value: 'rating', label: 'Community rating' }, { value: 'mine', label: 'Your rating' }, { value: 'title', label: 'Title' }]}
			defaultSort="year"
			filters={[
				{ key: 'type', label: 'Type', options: data.types.map((t) => ({ value: t, label: t === 'ep' ? 'EP' : t.charAt(0).toUpperCase() + t.slice(1) })) },
				{ key: 'decade', label: 'Decade', options: data.decades.map((d) => ({ value: String(d), label: `${d}s` })) }
			]}
		/>
		{#if data.albums.length}
			<div class="album-grid">
				{#each data.albums as a (a.id)}
					<AlbumCard item={{ id: a.id, kind: 'album', title: a.title, cover_url: a.cover_url, release_year: a.release_year, artist_name: artist.title, artist_id: artist.id, parent_id: null, mbid: null, release_date: null, genres: [], record_type: a.record_type, duration_ms: null, position: null, label: null, track_count: null, fetched_at: '' }} stats={a} showArtist={false} subtitle={[a.release_year, a.record_type && a.record_type !== 'album' ? a.record_type.toUpperCase() : null].filter(Boolean).join(' · ')} />
				{/each}
			</div>
		{:else}
			<div class="empty">Nothing matches those filters.</div>
		{/if}
	</section>
</div>

<style>
	.artist-hero {
		position: relative;
		overflow: hidden;
		padding: 3rem 0 2rem;
		border-bottom: 1px solid var(--border);
	}
	.backdrop {
		position: absolute;
		inset: -40px;
		background: var(--bg, none) center/cover no-repeat;
		filter: blur(40px) saturate(0.7) brightness(0.35);
		opacity: 0.7;
	}
	.artist-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(10, 15, 11, 0.2), var(--bg) 100%);
	}
	.hero-inner {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}
	.portrait {
		width: 150px;
		height: 150px;
		border-radius: 50%;
		object-fit: cover;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
		flex-shrink: 0;
	}
	.artist-hero h1 {
		font-size: 2.6rem;
		text-shadow: var(--glow-green);
		margin: 0.1rem 0 0.3rem;
	}
	.links {
		display: flex;
		gap: 0.9rem;
		margin-top: 0.6rem;
		flex-wrap: wrap;
	}
	.links a {
		color: var(--muted);
	}
	.links a:hover {
		color: var(--accent);
	}
	.section.first {
		margin-top: 0;
	}
	.top {
		list-style: none;
	}
	.top-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.92rem;
	}
	.num {
		width: 1.2rem;
		text-align: right;
		font-size: 0.8rem;
	}
	.thumb {
		width: 40px;
		height: 40px;
	}
	.mine {
		color: var(--muted);
		font-size: 0.8rem;
	}
	.mine.has {
		color: var(--accent);
	}
	.dur {
		width: 2.6rem;
		text-align: right;
	}
	@media (max-width: 580px) {
		.portrait {
			width: 96px;
			height: 96px;
		}
		.artist-hero h1 {
			font-size: 1.9rem;
		}
		.dur {
			display: none;
		}
	}
</style>
