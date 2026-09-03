<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { formatDate, timeAgo } from '$lib/utils';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let q = $state(data.q);
	const mine = $derived(new Set(data.mine));
	const theirs = $derived(new Set(data.theirs));
	function submit(e: SubmitEvent) {
		e.preventDefault();
		const url = new URL(page.url);
		if (q.trim()) url.searchParams.set('q', q.trim());
		else url.searchParams.delete('q');
		goto(url, { keepFocus: true });
	}
</script>

<svelte:head><title>Members · Soundtrackd</title></svelte:head>

<div class="container page">
	<div class="section-head"><h1>Members</h1><span class="muted small">{data.members.length} shown</span></div>
	<form class="row bar" onsubmit={submit} role="search">
		<input class="input" type="search" placeholder="Find a member…" bind:value={q} />
		<button class="btn" type="submit">Search</button>
	</form>
	<SortBar sorts={[{ value: 'joined', label: 'Newest' }, { value: 'reviews', label: 'Most ratings' }, { value: 'active', label: 'Recently active' }, { value: 'username', label: 'Username' }]} defaultSort="joined" allowDir={false} />

	{#if data.members.length}
		<div class="grid">
			{#each data.members as m (m.id)}
				<div class="card tight member">
					<Avatar profile={{ id: String(m.id), username: String(m.username), avatar_url: m.avatar_url as string | null, accent_color: m.accent_color as string | null, supporter_until: m.supporter_until as string | null }} size={44} />
					<div class="grow truncate">
						<a class="name" href="/profile/{encodeURIComponent(String(m.username))}">{m.username}</a> <SupporterBadge profile={{ supporter_until: m.supporter_until as string | null }} small />
						{#if m.status_text}<div class="small truncate">{m.status_emoji ?? ''} {m.status_text}</div>{/if}
						<div class="muted tiny">{m.review_count} ratings · joined {formatDate(String(m.created_at), { month: 'short', day: undefined })}{#if m.last_seen_at} · seen {timeAgo(String(m.last_seen_at))}{/if}</div>
					</div>
					{#if page.data.user && page.data.user.id !== m.id}
						<FollowButton userId={String(m.id)} following={mine.has(String(m.id))} followsMe={theirs.has(String(m.id))} small menu={false} />
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">No members match.</div>
	{/if}
</div>

<style>
	.bar {
		margin-bottom: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.member {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.name {
		font-weight: 500;
	}
	.name:hover {
		color: var(--accent);
	}
</style>
