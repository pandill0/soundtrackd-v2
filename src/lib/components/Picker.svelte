<script lang="ts">
	import type { CatalogItem, CatalogKind } from '$lib/types';

	/**
	 * Search-and-pick modal backed by /api/catalog/search. Used for favourites, list items,
	 * "send a record" in chat, and the now-spinning picker. One picker, every surface (§11 #1).
	 */
	let {
		kind = 'album',
		title = 'Find a record',
		onpick,
		onclose
	}: { kind?: CatalogKind | 'all'; title?: string; onpick: (item: CatalogItem) => void; onclose: () => void } = $props();

	let q = $state('');
	let results = $state<CatalogItem[]>([]);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function search() {
		clearTimeout(timer);
		if (q.trim().length < 2) {
			results = [];
			return;
		}
		loading = true;
		timer = setTimeout(async () => {
			const r = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&kind=${kind}&limit=12`).then((r) => r.json());
			results = kind === 'artist' ? r.artists : kind === 'track' ? r.tracks : kind === 'album' ? r.albums : [...r.albums, ...r.tracks, ...r.artists];
			loading = false;
		}, 300);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div class="modal" role="dialog" aria-modal="true" aria-label={title}>
		<div class="modal-head">
			<h3>{title}</h3>
			<button class="modal-close" onclick={onclose} aria-label="Close">×</button>
		</div>
		<!-- svelte-ignore a11y_autofocus -->
		<input class="input" placeholder="Search…" bind:value={q} oninput={search} autofocus autocomplete="off" />
		<div class="results">
			{#if loading}
				<div class="skeleton" style="height:48px"></div>
			{:else if results.length}
				{#each results as r (r.id)}
					<button class="list-row pick" onclick={() => onpick(r)}>
						{#if r.cover_url}<img class="thumb" class:round={r.kind === 'artist'} src={r.cover_url} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}
						<span class="grow truncate">
							<span class="t">{r.title}</span>
							<span class="muted small">{r.kind === 'artist' ? 'Artist' : [r.artist_name, r.release_year].filter(Boolean).join(' · ')}</span>
						</span>
						<span class="tag">{r.kind}</span>
					</button>
				{/each}
			{:else if q.trim().length >= 2}
				<p class="muted small center">Nothing found.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.results {
		margin-top: 0.75rem;
		max-height: 50vh;
		max-height: 50dvh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	.pick {
		width: 100%;
		text-align: left;
		border-radius: var(--radius-sm);
		padding: 0.5rem;
	}
	.pick:hover {
		background: var(--surface2);
	}
	.pick .t {
		display: block;
		font-size: 0.9rem;
	}
	.thumb.round {
		border-radius: 50%;
	}
</style>
