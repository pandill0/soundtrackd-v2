<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Soundtrackd</title></svelte:head>

<div class="container page center err">
	<div class="avg-rating">{page.status}</div>
	<h1 class="serif">{page.status === 404 ? 'Nothing on this side of the record.' : 'That skipped.'}</h1>
	<p class="muted">{page.error?.message ?? 'Something went wrong.'}</p>
	<div class="row" style="justify-content:center">
		<a class="btn btn-primary" href="/">Home</a>
		<a class="btn" href="/search">Search</a>
	</div>
</div>

<style>
	.err {
		padding-top: 5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}
</style>
