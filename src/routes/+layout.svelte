<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { navigating } from '$app/state';
	import Nav from '$lib/components/Nav.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import RateModal from '$lib/components/RateModal.svelte';
	import { getBrowserClient } from '$lib/supabase/client';

	let { data, children } = $props();

	// Keep server and browser auth state in sync (token refreshes, sign-out in another tab).
	onMount(() => {
		const {
			data: { subscription }
		} = getBrowserClient().auth.onAuthStateChange((event, newSession) => {
			if (event === 'INITIAL_SESSION') return;
			if ((newSession?.expires_at ?? null) !== (data.session?.expires_at ?? null)) invalidate('supabase:auth');
		});
		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>Soundtrackd</title>
</svelte:head>

{#if navigating.to}
	<div class="progress" role="progressbar" aria-label="Loading"></div>
{/if}
<Nav />
<main class="site-main">
	{@render children()}
</main>
<Footer />
<MobileNav />
<RateModal />

<style>
	.site-main {
		min-height: calc(100vh - var(--nav-h));
	}
	.progress {
		position: fixed;
		top: 0;
		left: 0;
		height: 2px;
		width: 30%;
		background: var(--accent);
		box-shadow: var(--glow-green);
		z-index: 100;
		animation: progress 1.2s ease-in-out infinite;
	}
	@keyframes progress {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400vw);
		}
	}
</style>
