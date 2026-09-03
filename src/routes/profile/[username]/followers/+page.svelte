<script lang="ts">
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';

	let { data } = $props();
	const mine = $derived(new Set(data.mine));
	const theirs = $derived(new Set(data.theirs));
</script>

<svelte:head><title>{data.username} · {data.which} · Soundtrackd</title></svelte:head>

<div class="container page narrow">
	<div class="eyebrow"><a href="/profile/{encodeURIComponent(data.username)}">{data.username}</a></div>
	<div class="tabs">
		<a class="tab" class:active={data.which === 'followers'} href="/profile/{encodeURIComponent(data.username)}/followers">Followers</a>
		<a class="tab" class:active={data.which === 'following'} href="/profile/{encodeURIComponent(data.username)}/following">Following</a>
	</div>
	{#if data.people.length}
		{#each data.people as u (u.id)}
			<div class="list-row">
				<Avatar profile={u} size={40} />
				<div class="grow truncate">
					<a href="/profile/{encodeURIComponent(u.username)}" class="name">{u.username}</a> <SupporterBadge profile={u} small />
					{#if u.status_text}<div class="muted small truncate">{u.status_emoji ?? ''} {u.status_text}</div>{/if}
				</div>
				{#if page.data.user && page.data.user.id !== u.id}
					<FollowButton userId={u.id} following={mine.has(u.id)} followsMe={theirs.has(u.id)} small menu={false} />
				{/if}
			</div>
		{/each}
	{:else}
		<div class="empty">{data.which === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</div>
	{/if}
</div>

<style>
	.narrow {
		max-width: 620px;
	}
	.name {
		font-weight: 500;
	}
	.name:hover {
		color: var(--accent);
	}
</style>
