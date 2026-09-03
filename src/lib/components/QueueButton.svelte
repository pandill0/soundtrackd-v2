<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	/** Add to / remove from the listen queue (§8.1). Appears on album pages, search results, grids. */
	let { itemId, inQueue = false, compact = false }: { itemId: string; inQueue?: boolean; compact?: boolean } = $props();

	// svelte-ignore state_referenced_locally
	let queued = $state(inQueue);
	let busy = $state(false);

	async function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		busy = true;
		const next = !queued;
		queued = next;
		const res = await fetch('/api/queue', {
			method: next ? 'POST' : 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: itemId })
		});
		if (!res.ok) queued = !next;
		busy = false;
	}
</script>

{#if compact}
	<button class="qb compact" class:on={queued} onclick={toggle} disabled={busy} title={queued ? 'In your queue — click to remove' : 'Add to listen queue'} aria-pressed={queued}>
		{queued ? '✓' : '+'}
	</button>
{:else}
	<button class="btn" class:active={queued} onclick={toggle} disabled={busy} aria-pressed={queued}>
		{#if queued}✓ In your queue{:else}+ Listen later{/if}
	</button>
{/if}

<style>
	.qb.compact {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(10, 15, 11, 0.85);
		color: var(--text);
		font-size: 0.95rem;
		line-height: 1;
		border: 1px solid var(--border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.qb.compact.on {
		color: var(--accent);
		border-color: rgba(74, 158, 107, 0.6);
	}
</style>
