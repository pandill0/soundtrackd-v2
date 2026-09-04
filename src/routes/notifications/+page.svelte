<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();

	// The server marked everything read while loading this page; refresh the nav badge to match.
	onMount(() => {
		if (data.hadUnread) invalidate('app:unread');
	});

	const describe = (n: (typeof data.items)[number]) => {
		const who = n.from_profile?.username ?? 'Someone';
		switch (n.type) {
			case 'follow':
				return { text: `${who} started following you`, href: n.from_profile ? `/profile/${encodeURIComponent(n.from_profile.username)}` : '/members' };
			case 'review_like': {
				const a = n.ref_id ? data.albums[n.ref_id] : null;
				return { text: `${who} liked your review${a?.album_title ? ` of ${a.album_title}` : ''}`, href: a?.catalog_item_id ? `/album/${a.catalog_item_id}` : '/notifications' };
			}
			case 'friend_request':
				return { text: `${who} wanted to be friends — follow them back and you will be`, href: n.from_profile ? `/profile/${encodeURIComponent(n.from_profile.username)}` : '/friends' };
			case 'friend_accepted':
				return { text: `${who} follows you too — you're now friends`, href: n.from_profile ? `/profile/${encodeURIComponent(n.from_profile.username)}` : '/friends' };
			case 'message':
				return { text: `New message from ${who}`, href: n.ref_id ? `/messages/${n.ref_id}` : '/messages' };
			default:
				return { text: n.type, href: '/notifications' };
		}
	};
</script>

<svelte:head><title>Notifications · Soundtrackd</title></svelte:head>

<div class="container page narrow">
	<h1>Notifications</h1>
	{#if data.items.length}
		<div class="list">
			{#each data.items as n (n.id)}
				{@const d = describe(n)}
				<a class="list-row item" class:unread={!n.read} href={d.href}>
					<Avatar profile={n.from_profile} size={36} link={false} />
					<span class="grow">{d.text}</span>
					<span class="muted tiny">{timeAgo(n.created_at)}</span>
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty">Nothing yet. Follow a few people and rate some records — it'll fill up.</div>
	{/if}
</div>

<style>
	.narrow {
		max-width: 620px;
	}
	h1 {
		margin-bottom: 1rem;
	}
	.item {
		font-size: 0.92rem;
		padding: 0.7rem 0.5rem;
		border-radius: var(--radius-sm);
	}
	.item:hover {
		background: var(--surface);
	}
	.item.unread {
		background: rgba(74, 158, 107, 0.07);
	}
</style>
