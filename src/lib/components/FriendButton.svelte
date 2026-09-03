<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { Friendship } from '$lib/types';

	/** Friend request / accept / unfriend / block — the mutual graph that gates DMs (§8.1). */
	let { userId, friendship = null, small = false }: { userId: string; friendship?: Friendship | null; small?: boolean } = $props();
	let busy = $state(false);
	let menu = $state(false);

	const me = $derived(page.data.user?.id);
	const rel = $derived(
		!friendship ? 'none'
		: friendship.status === 'accepted' ? 'friends'
		: friendship.status === 'blocked' ? (friendship.blocked_by === me ? 'blocked' : 'hidden')
		: friendship.addressee_id === me ? 'incoming' : 'outgoing'
	);

	async function act(action: string, extra: Record<string, unknown> = {}) {
		if (!me) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		busy = true;
		menu = false;
		const res = await fetch('/api/friend', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, user_id: userId, ...extra })
		});
		if (!res.ok) alert((await res.json().catch(() => ({}))).message ?? 'That did not work');
		busy = false;
		await invalidateAll();
	}
</script>

<div class="friend-btn">
	{#if rel === 'none'}
		<button class="btn" class:btn-sm={small} onclick={() => act('request')} disabled={busy}>+ Add friend</button>
	{:else if rel === 'outgoing'}
		<button class="btn btn-ghost" class:btn-sm={small} onclick={() => act('remove')} disabled={busy} title="Cancel request">Request sent</button>
	{:else if rel === 'incoming'}
		<button class="btn btn-primary" class:btn-sm={small} onclick={() => act('accept', { id: friendship?.id })} disabled={busy}>Accept friend request</button>
		<button class="btn btn-ghost" class:btn-sm={small} onclick={() => act('decline', { id: friendship?.id })} disabled={busy}>Decline</button>
	{:else if rel === 'friends'}
		<button class="btn active" class:btn-sm={small} onclick={() => (menu = !menu)} disabled={busy}>✓ Friends</button>
		{#if menu}
			<div class="menu card tight">
				<a class="item" href="/messages/new?to={userId}">Message</a>
				<button class="item" onclick={() => confirm('Remove this friend?') && act('remove')}>Unfriend</button>
				<button class="item danger" onclick={() => confirm('Block this member? They will no longer be able to message or friend you.') && act('block')}>Block</button>
			</div>
		{/if}
	{:else if rel === 'blocked'}
		<button class="btn btn-danger" class:btn-sm={small} onclick={() => act('unblock')} disabled={busy}>Unblock</button>
	{/if}
	{#if rel !== 'friends' && rel !== 'blocked' && rel !== 'hidden'}
		<button class="btn btn-ghost btn-icon" class:btn-sm={small} onclick={() => (menu = !menu)} aria-label="More" title="More">⋯</button>
		{#if menu}
			<div class="menu card tight">
				<button class="item danger" onclick={() => confirm('Block this member?') && act('block')}>Block</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.friend-btn {
		position: relative;
		display: inline-flex;
		gap: 0.4rem;
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		min-width: 160px;
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
