<script lang="ts">
	import { page } from '$app/state';

	const profile = $derived(page.data.profile);
	const isActive = (href: string) =>
		page.url.pathname === href || (href !== '/' && page.url.pathname.startsWith(href + '/'));
</script>

<!--
  Fixed bottom icon nav for phones (§3 Responsive). It is deliberately NOT a <nav> styled by
  a bare element selector — v1's whole-page blur bug (§11 #2) came from `nav { top: 0 }` leaking in.
-->
<nav class="mobile-nav" aria-label="Mobile">
	<a href={profile ? '/dash' : '/'} class:active={isActive(profile ? '/dash' : '/')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
		<span>Home</span>
	</a>
	<a href="/search" class:active={isActive('/search')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
		<span>Search</span>
	</a>
	<a href="/charts" class:active={isActive('/charts')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
		<span>Charts</span>
	</a>
	<a href="/lists" class:active={isActive('/lists')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
		<span>Lists</span>
	</a>
	{#if profile}
		<a href="/profile/{encodeURIComponent(profile.username)}" class:active={isActive('/profile')}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
			<span>You</span>
		</a>
	{:else}
		<a href="/login" class:active={isActive('/login')}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 17l5-5-5-5M15 12H3M21 3v18" /></svg>
			<span>Sign in</span>
		</a>
	{/if}
</nav>

<style>
	.mobile-nav {
		display: none;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		top: auto; /* belt and braces — see §11 bug #2 */
		height: 60px;
		z-index: 60;
		background: rgba(10, 15, 11, 0.92);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom);
	}
	.mobile-nav a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 500;
	}
	.mobile-nav a.active {
		color: var(--accent);
	}
	.mobile-nav svg {
		width: 21px;
		height: 21px;
	}
	@media (max-width: 580px) {
		.mobile-nav {
			display: flex;
		}
	}
</style>
