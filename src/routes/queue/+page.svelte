<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import SortBar from '$lib/components/SortBar.svelte';
	import { formatAvg } from '$lib/stars';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
	let picked = $state<string | null>(null);

	async function remove(id: string) {
		await fetch('/api/queue', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
		await invalidateAll();
	}
	async function editNote(id: string, current: string | null) {
		const note = prompt('Note (e.g. "recommended by Sam")', current ?? '');
		if (note === null) return;
		await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, note }) });
		await invalidateAll();
	}
	function pickForMe() {
		if (!data.items.length) return;
		const item = data.items[Math.floor(Math.random() * data.items.length)];
		picked = item.catalog_item_id;
		setTimeout(() => goto(`/album/${item.catalog_item_id}`), 700);
	}
</script>

<svelte:head><title>Listen queue · Soundtrackd</title></svelte:head>

<div class="container page">
	<div class="section-head">
		<h1>Listen queue</h1>
		<div class="row">
			<span class="muted small">{data.items.length} to hear · {data.queuePublic ? 'public' : 'private'} (<a class="link" href="/settings">change</a>)</span>
			<button class="btn btn-primary btn-sm" onclick={pickForMe} disabled={!data.items.length}>🎲 Pick something for me</button>
		</div>
	</div>

	<SortBar
		sorts={[{ value: 'added', label: 'Date added' }, { value: 'year', label: 'Release year' }, { value: 'artist', label: 'Artist' }, { value: 'rating', label: 'Community rating' }]}
		defaultSort="added"
		filters={[
			{ key: 'genre', label: 'Genre', options: data.genres.map((g) => ({ value: g, label: g })) },
			{ key: 'decade', label: 'Decade', options: data.decades.map((d) => ({ value: String(d), label: `${d}s` })) }
		]}
	/>

	{#if data.items.length}
		<div class="list">
			{#each data.items as it (it.catalog_item_id)}
				<div class="list-row q" class:picked={picked === it.catalog_item_id}>
					<a href="/album/{it.catalog_item_id}">{#if it.cover_url}<img class="thumb lg" src={it.cover_url} alt="" loading="lazy" />{:else}<span class="thumb lg"></span>{/if}</a>
					<div class="grow truncate">
						<a class="t" href="/album/{it.catalog_item_id}">{it.title}</a>
						<div class="muted small truncate">
							{#if it.artist_id}<a href="/artist/{it.artist_id}">{it.artist_name}</a>{:else}{it.artist_name ?? ''}{/if}
							{#if it.release_year} · {it.release_year}{/if}
							{#if it.rating_count} · <span class="gold">★ {formatAvg(it.avg_rating)}</span> <span class="tiny">({it.rating_count})</span>{/if}
						</div>
						<button class="note" onclick={() => editNote(it.catalog_item_id, it.note)}>{it.note ? `“${it.note}”` : '+ add a note'}</button>
					</div>
					<span class="muted tiny when">{timeAgo(it.added_at)}</span>
					<button class="btn btn-xs btn-ghost" onclick={() => remove(it.catalog_item_id)} title="Remove">✕</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			Nothing queued. The "+ Listen later" button on any album adds it here.
			<br /><a class="btn btn-sm btn-primary" href="/charts">Browse the charts</a>
		</div>
	{/if}
</div>

<style>
	.q {
		transition: background 0.3s;
		border-radius: var(--radius-sm);
		padding: 0.7rem 0.4rem;
	}
	.q.picked {
		background: rgba(74, 158, 107, 0.15);
	}
	.t {
		font-weight: 500;
	}
	.t:hover {
		color: var(--accent);
	}
	.note {
		display: block;
		color: var(--muted);
		font-size: 0.8rem;
		font-style: italic;
		padding: 0;
		margin-top: 0.1rem;
	}
	.note:hover {
		color: var(--accent);
	}
	.when {
		min-width: 4rem;
		text-align: right;
	}
	@media (max-width: 580px) {
		.when {
			display: none;
		}
	}
</style>
