<script module lang="ts">
	type TurnstileApi = {
		render: (el: HTMLElement, opts: Record<string, unknown>) => string;
		remove: (id: string) => void;
	};
	const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
	let loader: Promise<void> | null = null;

	/** Loads Cloudflare's Turnstile script once per page, however many widgets render. */
	function loadScript(): Promise<void> {
		if (api()) return Promise.resolve();
		loader ??= new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			s.async = true;
			s.onload = () => resolve();
			s.onerror = () => {
				loader = null;
				reject(new Error('Turnstile failed to load'));
			};
			document.head.appendChild(s);
		});
		return loader;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { config } from '$lib/config';

	/**
	 * Cloudflare Turnstile, the "are you human" check. Place it inside a form: it adds a hidden
	 * `cf-turnstile-response` field, which the form action passes to Supabase as captchaToken.
	 * Tokens are single-use, so re-create it (e.g. with {#key}) after each submission.
	 * Renders nothing when PUBLIC_TURNSTILE_SITE_KEY is not set.
	 */
	const sitekey = config.turnstileSiteKey;
	let el = $state<HTMLDivElement>();

	onMount(() => {
		if (!sitekey || !el) return;
		let id: string | undefined;
		let gone = false;
		loadScript()
			.then(() => {
				const ts = api();
				if (gone || !ts || !el) return;
				id = ts.render(el, { sitekey, theme: 'dark', size: el.clientWidth < 300 ? 'compact' : 'flexible' });
			})
			.catch(() => {
				/* Blocked or offline: the form still submits, and the server explains if Supabase rejects it. */
			});
		return () => {
			gone = true;
			if (id) api()?.remove(id);
		};
	});
</script>

{#if sitekey}<div class="turnstile" bind:this={el}></div>{/if}

<style>
	.turnstile {
		width: 100%;
		min-height: 65px;
	}
</style>
