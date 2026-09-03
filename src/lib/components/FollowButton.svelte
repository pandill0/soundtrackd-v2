<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	/**
	 * The one social button (Letterboxd model): Follow → Following → Friends when they follow
	 * you back. Friends unlock messaging. A small menu holds Message / Unfollow / Block.
	 */
	let {
		userId,
		following = false,
		followsMe = false,
		blockedByMe = false,
		small = false,
		menu = true
	}: { userId: string; following?: boolean; followsMe?: boolean; blockedByMe?: boolean; small?: boolean; menu?: boolean } = $props();

	// svelte-ignore state_referenced_locally
	let on = $state(following);
	let busy = $state(false);
	let open = $state(false);
	const friends = $derived(on && followsMe);

	async function setFollow(next: boolean) {
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		busy = true;
		open = false;
		on = next;
		const res = await fetch('/api/follow', {
			method: next ? 'POST' : 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ user_id: userId })
		});
		if (!res.ok) on = !next;
		busy = false;
		await invalidateAll();
	}
	async function block(action: 'block' | 'unblock') {
		if (action === 'block' && !confirm('Block this member? You unfollow each other and they can no longer follow or message you.')) return;
		busy = true;
		open = false;
		await fetch('/api/friend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, user_id: userId }) });
		busy = false;
		await invalidateAll();
	}
</script>

<svelte:window onclick={() => (open = false)} />

<div class="follow" role="group">
	{#if blockedByMe}
		<button class="btn btn-danger" class:btn-sm={small} onclick={() => block('unblock')} disabled={busy}>Unblock</button>
	{:else if friends}
		<button class="btn active" class:btn-sm={small} onclick={(e) => { e.stopPropagation(); open = !open; }} disabled={busy} aria-expanded={open}>✓ Friends</button>
	{:else if on}
		<button class="btn btn-ghost following" class:btn-sm={small} onclick={() => setFollow(false)} disabled={busy} title="Unfollow">
			<span class="a">Following</span><span class="b">Unfollow</span>
		</button>
	{:else}
		<button class="btn btn-primary" class:btn-sm={small} onclick={() => setFollow(true)} disabled={busy}>{followsMe ? 'Follow back' : 'Follow'}</button>
	{/if}
	{#if menu && !blockedByMe}
		<button class="btn btn-ghost btn-icon more" class:btn-sm={small} onclick={(e) => { e.stopPropagation(); open = !open; }} aria-label="More" aria-expanded={open}>⋯</button>
	{/if}
	{#if open}
		<div class="menu card tight" role="menu">
			{#if friends}<a class="item" role="menuitem" href="/messages/new?to={userId}">Message</a>{/if}
			{#if on}<button class="item" role="menuitem" onclick={() => setFollow(false)}>Unfollow</button>{/if}
			<button class="item danger" role="menuitem" onclick={() => block('block')}>Block</button>
		</div>
	{/if}
</div>

<style>
	.follow {
		position: relative;
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}
	.following .b {
		display: none;
	}
	.following:hover .a {
		display: none;
	}
	.following:hover .b {
		display: inline;
		color: var(--danger);
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 30;
		min-width: 150px;
		display: flex;
		flex-direction: column;
		padding: 0.35rem;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
	}
	.item {
		text-align: left;
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		font-size: 0.88rem;
	}
	.item:hover {
		background: var(--surface2);
	}
	.item.danger {
		color: var(--danger);
	}
</style>
