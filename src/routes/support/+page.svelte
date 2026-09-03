<script lang="ts">
	import { page } from '$app/state';
	import { formatDate } from '$lib/utils';
	let { data } = $props();
</script>

<svelte:head><title>Support Soundtrackd</title></svelte:head>

<div class="container page support">
	<div class="eyebrow">Supporter</div>
	<h1>Keep the records spinning.</h1>
	<p class="lede">
		Soundtrackd is free — rating, reviewing, lists, friends and messages will always be free, for everyone.
		Supporters cover the servers and the catalogue, and get a few visible thank-yous in return.
	</p>

	<div class="card tier">
		<div class="price"><span class="amount">$18</span><span class="muted">/ year</span></div>
		<ul class="perks">
			<li>♥ A supporter badge on your profile and beside your reviews</li>
			<li>🎨 A custom accent colour for your name and avatar ring</li>
			<li>📜 Your name on the <a class="link" href="/supporters">supporters page</a></li>
		</ul>
		<p class="muted small">That's the whole list. No features are held back from free members — that's a promise, not a pricing strategy.</p>
		{#if data.supporter}
			<p class="success-msg">You're a supporter — thank you. Active until {formatDate(data.until)}.</p>
			<a class="btn" href="/settings">Pick your accent colour</a>
		{:else if !page.data.user}
			<a class="btn btn-primary" href="/login?next=/support">Sign in to support</a>
		{:else if data.checkoutUrl}
			<a class="btn btn-primary shine" href={data.checkoutUrl} rel="noopener">Become a supporter</a>
			<p class="muted tiny">Card details go straight to our payment provider, Lemon Squeezy, never to Soundtrackd. Annual billing, cancel any time; perks run to the end of the paid year.</p>
		{:else}
			<button class="btn" disabled>Coming soon</button>
			<p class="muted tiny">Checkout isn't switched on yet.</p>
		{/if}
	</div>
</div>

<style>
	.support {
		max-width: 560px;
	}
	h1 {
		margin: 0.25rem 0 0.75rem;
		text-shadow: var(--glow-green);
	}
	.lede {
		margin-bottom: 1.5rem;
	}
	.tier {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.75rem;
	}
	.price .amount {
		font-family: var(--font-serif);
		font-size: 2.6rem;
		color: var(--star);
		text-shadow: var(--glow-gold);
		margin-right: 0.3rem;
	}
	.perks {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
</style>
