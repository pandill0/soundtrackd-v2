<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import Picker from '$lib/components/Picker.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { formatAvg, starString } from '$lib/stars';
	import type { CatalogItem, ListItem } from '$lib/types';
	import { timeAgo } from '$lib/utils';

	let { data, form } = $props();
	const list = $derived(data.list);
	// svelte-ignore state_referenced_locally
	let editing = $state(data.editing);
	// svelte-ignore state_referenced_locally
	let items = $state<ListItem[]>([...data.list.items]);
	let picking = $state(false);
	let dirty = $state(false);
	// svelte-ignore state_referenced_locally
	let liked = $state(data.liked);
	// svelte-ignore state_referenced_locally
	let likeCount = $state(data.likeCount);
	let saveForm: HTMLFormElement | undefined = $state();

	const pickKind = $derived(list.type === 'albums' ? 'album' : list.type === 'songs' ? 'track' : 'all');
	const href = (it: ListItem) => (it.catalogId ? (it.type === 'track' ? `/song/${it.catalogId}` : `/album/${it.catalogId}`) : `/search?q=${encodeURIComponent(`${it.artist} ${it.title}`)}`);

	function add(item: CatalogItem) {
		if (item.kind === 'artist') return;
		items = [...items, { id: item.id, catalogId: item.id, type: item.kind === 'track' ? 'track' : 'album', title: item.title, artist: item.artist_name ?? '', cover: item.cover_url ?? '', albumId: item.kind === 'track' ? item.parent_id : null }];
		dirty = true;
		picking = false;
	}
	function move(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= items.length) return;
		const copy = [...items];
		[copy[i], copy[j]] = [copy[j], copy[i]];
		items = copy;
		dirty = true;
	}
	function remove(i: number) {
		items = items.filter((_, k) => k !== i);
		dirty = true;
	}
	async function toggleLike() {
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		liked = !liked;
		likeCount += liked ? 1 : -1;
		const res = await fetch('/api/list-like', { method: liked ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list_id: list.id }) });
		if (!res.ok) {
			liked = !liked;
			likeCount += liked ? 1 : -1;
		}
	}
</script>

<svelte:head><title>{list.title} · Soundtrackd</title></svelte:head>

<div class="container page list-page">
	<header class="head">
		<div class="grow">
			<div class="eyebrow">{list.type === 'songs' ? 'Song list' : list.type === 'mixed' ? 'Mixed list' : 'Album list'}</div>
			{#if editing}
				<form method="POST" action="?/update" class="stack" use:enhance>
					<input class="input big" name="title" value={list.title} required maxlength="120" />
					<textarea class="textarea" name="description" placeholder="Description" maxlength="2000">{list.description ?? ''}</textarea>
					<div class="row"><button class="btn btn-sm btn-primary" type="submit">Save details</button></div>
				</form>
			{:else}
				<h1>{list.title}</h1>
				{#if list.description}<p class="prose desc">{list.description}</p>{/if}
			{/if}
			<div class="row by">
				<Avatar profile={data.owner} size={24} />
				<a href="/profile/{encodeURIComponent(data.owner.username)}">{data.owner.username}</a> <SupporterBadge profile={data.owner} small />
				<span class="muted tiny">· {items.length} {list.type === 'songs' ? 'songs' : 'items'} · updated {timeAgo(list.updated_at)}</span>
			</div>
		</div>
		<div class="actions">
			<button class="btn btn-sm" class:active={liked} onclick={toggleLike} aria-pressed={liked}>♥ {likeCount}</button>
			{#if data.own}
				{#if editing}
					<button class="btn btn-sm btn-ghost" onclick={() => (editing = false)}>Done</button>
				{:else}
					<button class="btn btn-sm" onclick={() => (editing = true)}>Edit</button>
				{/if}
			{/if}
		</div>
	</header>

	{#if form?.error}<p class="error-msg">{form.error}</p>{/if}

	{#if editing}
		<form method="POST" action="?/items" bind:this={saveForm} use:enhance={() => { dirty = false; return async ({ update }) => update({ reset: false }); }} class="editbar card tight">
			<input type="hidden" name="items" value={JSON.stringify(items)} />
			<button type="button" class="btn btn-sm btn-primary" onclick={() => (picking = true)}>+ Add {list.type === 'songs' ? 'a song' : list.type === 'mixed' ? 'an item' : 'an album'}</button>
			<button class="btn btn-sm" type="submit" disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</button>
			<span class="grow"></span>
			<button type="submit" class="btn btn-sm btn-danger" formaction="?/delete" onclick={(e) => !confirm('Delete this list?') && e.preventDefault()}>Delete list</button>
		</form>
	{/if}

	{#if items.length}
		<ol class="items" class:editing>
			{#each items as it, i (it.catalogId ?? it.id + i)}
				{@const s = it.catalogId ? data.stats[it.catalogId] : null}
				<li class="item">
					<span class="rank muted">{i + 1}</span>
					<a href={href(it)}><img class="thumb lg" src={it.cover} alt="" loading="lazy" /></a>
					<div class="grow truncate">
						<a class="t" href={href(it)}>{it.title}</a>
						<div class="muted small truncate">{it.artist}{#if it.type === 'track'} · song{/if}{#if !it.catalogId} · <span class="tiny">not yet linked</span>{/if}</div>
					</div>
					{#if s?.my_rating}<span class="accent small">{starString(Number(s.my_rating))}</span>{/if}
					{#if s?.rating_count}<span class="gold small">★ {formatAvg(s.avg_rating)}</span>{/if}
					{#if editing}
						<span class="edit-ctl">
							<button class="btn btn-xs btn-ghost" onclick={() => move(i, -1)} aria-label="Move up">↑</button>
							<button class="btn btn-xs btn-ghost" onclick={() => move(i, 1)} aria-label="Move down">↓</button>
							<button class="btn btn-xs btn-danger" onclick={() => remove(i)} aria-label="Remove">✕</button>
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<div class="empty">This list is empty.{#if data.own && !editing}<br /><button class="btn btn-sm btn-primary" onclick={() => (editing = true)}>Add items</button>{/if}</div>
	{/if}
</div>

{#if picking}
	<Picker kind={pickKind} title="Add to “{list.title}”" onpick={add} onclose={() => (picking = false)} />
{/if}

<style>
	.head {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}
	.head h1 {
		font-size: 2rem;
	}
	.desc {
		margin-top: 0.4rem;
		max-width: 65ch;
	}
	.by {
		margin-top: 0.6rem;
		font-size: 0.9rem;
	}
	.input.big {
		font-family: var(--font-serif);
		font-size: 1.5rem;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
	}
	.editbar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.items {
		list-style: none;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0.25rem;
		border-bottom: 1px solid var(--border);
	}
	.rank {
		width: 1.6rem;
		text-align: right;
		font-family: var(--font-serif);
	}
	.t {
		font-weight: 500;
	}
	.t:hover {
		color: var(--accent);
	}
	.edit-ctl {
		display: flex;
		gap: 0.2rem;
	}
</style>
