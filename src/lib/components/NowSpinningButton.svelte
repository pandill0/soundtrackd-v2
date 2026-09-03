<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	/** "Now Spinning" — one tap sets the manual now-playing slot (§8.1). */
	let { itemId, active = false }: { itemId: string; active?: boolean } = $props();
	let busy = $state(false);

	async function toggle() {
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		busy = true;
		await fetch('/api/now-playing', {
			method: active ? 'DELETE' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: itemId })
		});
		await invalidateAll();
		busy = false;
	}
</script>

<button class="btn" class:active onclick={toggle} disabled={busy} aria-pressed={active}>
	<span class="disc" class:spin={active} aria-hidden="true"></span>
	{active ? 'Now spinning' : 'Now spinning?'}
</button>

<style>
	.disc {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--star) 0 22%, #111 24% 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.disc.spin {
		animation: spin 2.4s linear infinite;
	}
</style>
