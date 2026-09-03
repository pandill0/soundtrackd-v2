<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import { timeAgo } from '$lib/utils';

	let { data, form } = $props();
	// svelte-ignore state_referenced_locally
	let creating = $state(data.openNew);
</script>

<svelte:head><title>Lists · Soundtrackd</title></svelte:head>

<div class="container page">
	<div class="section-head">
		<h1>Lists</h1>
		{#if page.data.user}
			<button class="btn btn-primary btn-sm" onclick={() => (creating = true)}>+ New list</button>
		{:else}
			<a class="btn btn-primary btn-sm" href="/login?next=/lists?new=1">+ New list</a>
		{/if}
	</div>

	<SortBar
		sorts={[{ value: 'updated', label: 'Recently updated' }, { value: 'likes', label: 'Most liked' }, { value: 'items', label: 'Most items' }, { value: 'created', label: 'Newest' }]}
		defaultSort="updated"
		allowDir={false}
		filters={[{ key: 'type', label: 'Type', options: [{ value: 'albums', label: 'Albums' }, { value: 'songs', label: 'Songs' }, { value: 'mixed', label: 'Mixed' }] }]}
	/>

	{#if data.lists.length}
		<div class="grid">
			{#each data.lists as l (l.id)}
				<a class="card tight list-card" href="/list/{l.id}">
					<div class="covers">
						{#each (l.items as { cover?: string }[]).slice(0, 5) as it, i (i)}<img src={it.cover} alt="" loading="lazy" />{/each}
						{#if !(l.items as unknown[]).length}<span class="covers-empty muted tiny">empty</span>{/if}
					</div>
					<div class="t">{l.title}</div>
					{#if l.description}<div class="muted small clamp-3">{l.description}</div>{/if}
					<div class="row foot">
						<Avatar profile={{ id: String(l.user_id), username: String(l.username), avatar_url: l.avatar_url as string | null, accent_color: l.accent_color as string | null, supporter_until: l.supporter_until as string | null }} size={20} link={false} />
						<span class="muted tiny">{l.username} · {l.item_count} {l.type === 'songs' ? 'songs' : l.type === 'mixed' ? 'items' : 'albums'} · {timeAgo(String(l.updated_at))}{#if Number(l.like_count)} · ♥ {l.like_count}{/if}</span>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty">No lists yet. Be the first to make one.</div>
	{/if}
</div>

{#if creating}
	<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (creating = false)}>
		<form class="modal stack" method="POST" action="?/create" use:enhance>
			<div class="modal-head"><h3>New list</h3><button type="button" class="modal-close" onclick={() => (creating = false)} aria-label="Close">×</button></div>
			<div class="field"><label for="title">Title</label><input class="input" id="title" name="title" required maxlength="120" placeholder="Albums that got me through 2025" /></div>
			<div class="field"><label for="desc">Description <span class="muted">(optional)</span></label><textarea class="textarea" id="desc" name="description" maxlength="2000"></textarea></div>
			<div class="field"><label for="type">Type</label>
				<select class="select" id="type" name="type"><option value="albums">Albums</option><option value="songs">Songs</option><option value="mixed">Mixed</option></select>
			</div>
			{#if form?.error}<p class="error-msg">{form.error}</p>{/if}
			<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" onclick={() => (creating = false)}>Cancel</button><button class="btn btn-primary" type="submit">Create</button></div>
		</form>
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.9rem;
	}
	.list-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.covers {
		display: flex;
		height: 56px;
		align-items: center;
	}
	.covers img {
		width: 56px;
		height: 56px;
		border-radius: 6px;
		margin-left: -18px;
		box-shadow: -3px 0 8px rgba(0, 0, 0, 0.45);
		background: var(--surface2);
	}
	.covers img:first-child {
		margin-left: 0;
	}
	.t {
		font-weight: 500;
		font-size: 1rem;
	}
	.foot {
		margin-top: auto;
	}
</style>
