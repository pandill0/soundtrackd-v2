<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import RateModal from '$lib/components/RateModal.svelte';

	let { data, children } = $props();

	// Keep server and browser auth state in sync (token refreshes, sign-out in another tab).
	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_event, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
		});
		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>Soundtrackd</title>
</svelte:head>

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
</style>
