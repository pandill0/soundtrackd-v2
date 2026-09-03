<script lang="ts">
	import { config } from '$lib/config';
</script>

<footer class="site-footer">
	<div class="container">
		<div class="foot-row">
			<span class="logo-sm">sound<em>trackd</em></span>
			<span class="muted tiny">v{config.version} · Letterboxd, for music.</span>
		</div>
		<p class="muted tiny attribution">
			Catalogue identity from <a class="link" href="https://musicbrainz.org" rel="noopener">MusicBrainz</a>
			(CC0). Search and artwork via Deezer. Trending via Last.fm. Not affiliated with any of them.
		</p>
		<div class="foot-links tiny">
			<a href="/charts">Charts</a>
			<a href="/lists">Lists</a>
			<a href="/members">Members</a>
			<a href="/supporters">Supporters</a>
			<a href="/support">Support Soundtrackd</a>
		</div>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--border);
		padding: 2rem 0 2.5rem;
		margin-top: 3rem;
		color: var(--muted);
	}
	.foot-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.logo-sm {
		font-family: var(--font-serif);
		font-size: 1.1rem;
		color: var(--text);
	}
	.logo-sm em {
		color: var(--accent);
	}
	.attribution {
		margin-top: 0.5rem;
		max-width: 60ch;
	}
	.foot-links {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}
	.foot-links a:hover {
		color: var(--accent);
	}
</style>
