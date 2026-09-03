<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';
	import Stars from './Stars.svelte';
	import SupporterBadge from './SupporterBadge.svelte';
	import { timeAgo } from '$lib/utils';

	interface Review {
		id: string;
		user_id: string;
		username: string;
		avatar_url: string | null;
		accent_color?: string | null;
		supporter_until?: string | null;
		rating: number;
		review: string | null;
		created_at: string;
		like_count?: number;
		liked_by_me?: boolean;
	}
	interface About {
		title: string;
		subtitle?: string | null;
		cover?: string | null;
		href: string;
	}

	let { review, about = null, likeable = true }: { review: Review; about?: About | null; likeable?: boolean } = $props();

	// svelte-ignore state_referenced_locally
	let liked = $state(review.liked_by_me ?? false);
	// svelte-ignore state_referenced_locally
	let count = $state(review.like_count ?? 0);
	let expanded = $state(false);
	const long = $derived((review.review?.length ?? 0) > 420);
	const profile = $derived({ id: review.user_id, username: review.username, avatar_url: review.avatar_url, accent_color: review.accent_color ?? null, supporter_until: review.supporter_until ?? null });

	async function toggleLike() {
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		// Optimistic (§9). The notification is fire-and-forget on the DB side.
		liked = !liked;
		count += liked ? 1 : -1;
		const res = await fetch('/api/like', {
			method: liked ? 'POST' : 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ rating_id: review.id })
		});
		if (!res.ok) {
			liked = !liked;
			count += liked ? 1 : -1;
		}
	}
</script>

<article class="review card tight">
	<header class="head">
		<Avatar {profile} size={32} />
		<div class="who">
			<a href="/profile/{encodeURIComponent(review.username)}" class="name">{review.username}</a>
			<SupporterBadge {profile} small />
			<span class="muted tiny">{timeAgo(review.created_at)}</span>
		</div>
		<Stars value={Number(review.rating)} size="0.85rem" />
	</header>

	{#if about}
		<a href={about.href} class="about">
			{#if about.cover}<img class="thumb" src={about.cover} alt="" loading="lazy" />{/if}
			<span class="truncate"><strong>{about.title}</strong>{#if about.subtitle}<span class="muted"> · {about.subtitle}</span>{/if}</span>
		</a>
	{/if}

	{#if review.review}
		<p class="body prose" class:clamp-3={long && !expanded}>{review.review}</p>
		{#if long}
			<button class="more" onclick={() => (expanded = !expanded)}>{expanded ? 'Show less' : 'Read more'}</button>
		{/if}
	{/if}

	{#if likeable}
		<footer class="foot">
			<button class="like" class:liked onclick={toggleLike} aria-pressed={liked} aria-label="Like this review">
				<svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
				{count > 0 ? count : ''}
			</button>
		</footer>
	{/if}
</article>

<style>
	.review {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.who {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.name {
		font-weight: 500;
		font-size: 0.9rem;
	}
	.name:hover {
		color: var(--accent);
	}
	.about {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		padding: 0.4rem 0.5rem;
		border-radius: var(--radius-sm);
		background: var(--surface2);
	}
	.about .thumb {
		width: 36px;
		height: 36px;
	}
	.body {
		font-size: 0.95rem;
		line-height: 1.65;
	}
	.more {
		align-self: flex-start;
		color: var(--accent);
		font-size: 0.8rem;
	}
	.foot {
		display: flex;
		gap: 0.75rem;
	}
	.like {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		font-size: 0.8rem;
		padding: 0.2rem 0.4rem;
		border-radius: var(--radius-sm);
		transition: color 0.15s;
	}
	.like:hover,
	.like.liked {
		color: var(--danger);
	}
</style>
