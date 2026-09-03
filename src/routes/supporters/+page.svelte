<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import { formatDate } from '$lib/utils';
	let { data } = $props();
</script>

<svelte:head><title>Supporters · Soundtrackd</title></svelte:head>

<div class="container page">
	<div class="eyebrow">With thanks</div>
	<h1>Supporters</h1>
	<p class="muted">The people who keep the lights on. <a class="link" href="/support">Join them.</a></p>
	{#if data.supporters.length}
		<div class="grid">
			{#each data.supporters as s (s.id)}
				<a class="card tight sup" href="/profile/{encodeURIComponent(s.username)}">
					<Avatar profile={{ id: s.id, username: s.username, avatar_url: s.avatar_url, accent_color: s.accent_color, supporter_until: '2999-01-01' }} size={40} link={false} />
					<span class="grow"><span class="name" style={s.accent_color ? `color:${s.accent_color}` : ''}>{s.username}</span><span class="muted tiny">since {formatDate(s.supporter_since, { month: 'short', day: undefined })}</span></span>
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty">Nobody yet. The first name here will be a founding one.</div>
	{/if}
</div>

<style>
	h1 {
		margin-bottom: 0.25rem;
	}
	p {
		margin-bottom: 1.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}
	.sup {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.name {
		display: block;
		font-weight: 500;
	}
</style>
