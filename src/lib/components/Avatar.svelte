<script lang="ts">
	import { supporterAccent } from '$lib/entitlements';
	import { hashHue } from '$lib/utils';
	import type { ProfileCard } from '$lib/types';

	let {
		profile,
		size = 36,
		link = true
	}: { profile: ProfileCard | null | undefined; size?: number; link?: boolean } = $props();

	const username = $derived(profile?.username ?? '?');
	const initial = $derived(username.slice(0, 1).toUpperCase());
	const hue = $derived(hashHue(username));
	const ring = $derived(profile ? supporterAccent(profile) : null);
	const href = $derived(profile && link ? `/profile/${encodeURIComponent(profile.username)}` : null);
	let broken = $state(false);
	$effect(() => {
		void profile?.avatar_url;
		broken = false;
	});
</script>

{#snippet inner()}
	{#if profile?.avatar_url && !broken}
		<img
			class="avatar"
			src={profile.avatar_url}
			alt=""
			onerror={() => (broken = true)}
			width={size}
			height={size}
			loading="lazy"
			style="width:{size}px;height:{size}px;{ring ? `box-shadow:0 0 0 2px ${ring}` : ''}"
		/>
	{:else}
		<span
			class="avatar placeholder"
			style="width:{size}px;height:{size}px;font-size:{size * 0.42}px;background:hsl({hue} 30% 22%);color:hsl({hue} 40% 78%);{ring
				? `box-shadow:0 0 0 2px ${ring}`
				: ''}"
			aria-label={username}>{initial}</span
		>
	{/if}
{/snippet}

{#if href}
	<a {href} class="avatar-link" title={username}>{@render inner()}</a>
{:else}
	{@render inner()}
{/if}

<style>
	.avatar-link {
		display: inline-flex;
		flex-shrink: 0;
	}
	.avatar {
		border-radius: 50%;
		object-fit: cover;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-family: var(--font-serif);
		background: var(--surface2);
	}
</style>
