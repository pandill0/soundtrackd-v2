<script lang="ts">
	import Avatar from './Avatar.svelte';
	import ReviewCard from './ReviewCard.svelte';
	import Stars from './Stars.svelte';
	import type { FeedEvent } from '$lib/types';
	import { timeAgo } from '$lib/utils';

	let { event }: { event: FeedEvent & { actor_accent?: string | null; actor_supporter_until?: string | null } } = $props();
	const p = $derived(event.payload as Record<string, string | number | null | undefined>);
	const actor = $derived({ id: event.actor_id, username: event.actor_username, avatar_url: event.actor_avatar, accent_color: event.actor_accent ?? null, supporter_until: event.actor_supporter_until ?? null });
	const itemHref = $derived(
		event.kind === 'track_rating'
			? p.item_id ? `/song/${p.item_id}` : '#'
			: p.item_id ? `/album/${p.item_id}` : `/search?q=${encodeURIComponent(String(p.title ?? ''))}`
	);
</script>

{#if (event.kind === 'rating' || event.kind === 'track_rating') && p.review}
	<ReviewCard
		review={{ id: event.id, user_id: event.actor_id, username: event.actor_username, avatar_url: event.actor_avatar, accent_color: actor.accent_color, supporter_until: actor.supporter_until, rating: Number(p.rating), review: String(p.review), created_at: event.created_at, like_count: Number(p.like_count ?? 0), liked_by_me: !!p.liked_by_me }}
		about={{ title: String(p.title ?? ''), subtitle: p.artist as string | null, cover: p.cover as string | null, href: itemHref }}
		likeable={event.kind === 'rating'}
	/>
{:else}
	<div class="feed-row">
		<Avatar profile={actor} size={32} />
		<div class="grow truncate">
			<a class="who" href="/profile/{encodeURIComponent(event.actor_username)}">{event.actor_username}</a>
			{#if event.kind === 'rating' || event.kind === 'track_rating'}
				rated <a class="what" href={itemHref}>{p.title}</a>{#if p.artist}<span class="muted"> · {p.artist}</span>{/if}
				<span class="stars"><Stars value={Number(p.rating)} size="0.8rem" /></span>
			{:else if event.kind === 'list'}
				made a list: <a class="what" href="/list/{event.id}">{p.title}</a> <span class="muted">({p.item_count} items)</span>
			{:else if event.kind === 'friendship'}
				became friends with <a class="what" href="/profile/{encodeURIComponent(String(p.other_username))}">{p.other_username}</a>
			{/if}
			<span class="muted tiny"> · {timeAgo(event.created_at)}</span>
		</div>
		{#if (event.kind === 'rating' || event.kind === 'track_rating') && p.cover}
			<a href={itemHref}><img class="thumb" src={String(p.cover)} alt="" loading="lazy" /></a>
		{/if}
	</div>
{/if}

<style>
	.feed-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.6rem 0.25rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.92rem;
	}
	.who {
		font-weight: 500;
	}
	.what {
		color: var(--accent);
	}
	.stars {
		margin-left: 0.3rem;
	}
</style>
