<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { userId, following = false, small = false }: { userId: string; following?: boolean; small?: boolean } = $props();
	// svelte-ignore state_referenced_locally
	let on = $state(following);
	let busy = $state(false);

	async function toggle() {
		if (!page.data.user) {
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		busy = true;
		const next = !on;
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
</script>

<button class="btn" class:btn-sm={small} class:btn-primary={!on} class:btn-ghost={on} onclick={toggle} disabled={busy} aria-pressed={on}>
	{on ? 'Following' : 'Follow'}
</button>
