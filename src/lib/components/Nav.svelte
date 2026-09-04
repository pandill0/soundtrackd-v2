<script lang="ts">
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';

	/** page.data.profile is always the signed-in member (set by the root layout; pages never reuse that key). */
	const profile = $derived(page.data.profile);
	const unread = $derived(
		(page.data as { unread?: { notifications: number; messages: number } }).unread ?? { notifications: 0, messages: 0 }
	);
	let menuOpen = $state(false);

	const publicLinks = [
		{ href: '/search', label: 'Search' },
		{ href: '/charts', label: 'Charts' },
		{ href: '/lists', label: 'Lists' },
		{ href: '/members', label: 'Members' }
	];
	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<svelte:window onclick={() => (menuOpen = false)} />

<header class="site-nav">
	<div class="container nav-inner">
		<a href={profile ? '/dash' : '/'} class="logo" aria-label="Soundtrackd home">sound<em>trackd</em></a>

		<nav class="nav-links" aria-label="Primary">
			{#each publicLinks as l (l.href)}
				<a href={l.href} class:active={isActive(l.href)}>{l.label}</a>
			{/each}
			{#if profile}
				<a href="/friends" class:active={isActive('/friends')}>Friends</a>
				<a href="/messages" class:active={isActive('/messages')}>
					Messages{#if unread.messages > 0}<span class="badge">{unread.messages}</span>{/if}
				</a>
			{/if}
		</nav>

		<div class="nav-user">
			{#if profile}
				<a href="/notifications" class="bell" class:active={isActive('/notifications')} aria-label="Notifications{unread.notifications ? `, ${unread.notifications} unread` : ''}">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
					</svg>
					{#if unread.notifications > 0}<span class="badge dot">{unread.notifications}</span>{/if}
				</a>
				<div class="user-menu">
					<button class="user-btn" onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }} aria-expanded={menuOpen} aria-haspopup="menu">
						<Avatar {profile} size={30} link={false} />
						<span class="name truncate">{profile.username}</span>
						<span class="caret" aria-hidden="true">▾</span>
					</button>
					{#if menuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
						<div class="menu card tight" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()}>
							<a class="item" role="menuitem" href="/profile/{encodeURIComponent(profile.username)}">Your profile</a>
							<a class="item" role="menuitem" href="/queue">Listen queue</a>
							<a class="item" role="menuitem" href="/settings">Settings</a>
							<form method="POST" action="/auth/signout"><button class="item" role="menuitem" type="submit">Sign out</button></form>
						</div>
					{/if}
				</div>
			{:else}
				<a href="/login" class="btn btn-primary btn-sm">Sign in</a>
			{/if}
		</div>
	</div>
</header>

<style>
	.site-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgba(10, 15, 11, 0.82);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
	}
	.nav-inner {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		height: var(--nav-h);
	}
	.logo {
		font-family: var(--font-serif);
		font-size: 1.45rem;
		color: var(--text);
		text-shadow: var(--glow-green);
		letter-spacing: 0.01em;
		flex-shrink: 0;
	}
	.logo em {
		color: var(--accent);
	}
	.nav-links {
		display: flex;
		gap: 1.1rem;
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 400;
		white-space: nowrap;
	}
	.nav-links a {
		color: var(--muted);
		transition: color 0.15s;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.nav-links a:hover,
	.nav-links a.active {
		color: var(--text);
	}
	.nav-links a.active {
		color: var(--accent);
	}
	.nav-user {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-left: auto;
		flex-shrink: 0;
	}
	.bell {
		position: relative;
		color: var(--muted);
		display: inline-flex;
		padding: 0.3rem;
	}
	.bell:hover,
	.bell.active {
		color: var(--text);
	}
	.bell .dot {
		position: absolute;
		top: -2px;
		right: -4px;
	}
	.user-menu {
		position: relative;
	}
	.user-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem 0.25rem 0.25rem;
		border-radius: 999px;
		color: var(--text);
		font-weight: 500;
		font-size: 0.9rem;
		max-width: 220px;
	}
	.user-btn:hover {
		background: var(--surface2);
	}
	.name {
		max-width: 140px;
		text-shadow: var(--glow-green);
	}
	.caret {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		min-width: 170px;
		display: flex;
		flex-direction: column;
		padding: 0.35rem;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		z-index: 60;
	}
	.item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		font-size: 0.88rem;
		color: var(--text);
	}
	.item:hover {
		background: var(--surface2);
	}
	@media (max-width: 780px) {
		.name,
		.caret {
			display: none;
		}
		.user-btn {
			padding: 0.2rem;
		}
	}
	@media (max-width: 580px) {
		.nav-links {
			display: none;
		}
		.nav-inner {
			gap: 0.75rem;
		}
	}
</style>
