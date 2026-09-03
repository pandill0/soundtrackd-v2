<script lang="ts">
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';

	const profile = $derived(page.data.profile);
	const unread = $derived(
		(page.data as { unread?: { notifications: number; messages: number } }).unread ?? {
			notifications: 0,
			messages: 0
		}
	);

	const publicLinks = [
		{ href: '/search', label: 'Search' },
		{ href: '/charts', label: 'Charts' },
		{ href: '/lists', label: 'Lists' },
		{ href: '/members', label: 'Members' }
	];
	const memberLinks = [
		{ href: '/queue', label: 'Queue' },
		{ href: '/friends', label: 'Friends' }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<header class="site-nav">
	<div class="container nav-inner">
		<a href={profile ? '/dash' : '/'} class="logo" aria-label="Soundtrackd home">
			sound<em>trackd</em>
		</a>

		<nav class="nav-links" aria-label="Primary">
			{#each publicLinks as l (l.href)}
				<a href={l.href} class:active={isActive(l.href)}>{l.label}</a>
			{/each}
			{#if profile}
				{#each memberLinks as l (l.href)}
					<a href={l.href} class:active={isActive(l.href)}>{l.label}</a>
				{/each}
				<a href="/messages" class:active={isActive('/messages')}>
					Messages{#if unread.messages > 0}<span class="badge">{unread.messages}</span>{/if}
				</a>
			{/if}
		</nav>

		<div class="nav-user">
			{#if profile}
				<a
					href="/notifications"
					class="bell"
					class:active={isActive('/notifications')}
					aria-label="Notifications{unread.notifications ? `, ${unread.notifications} unread` : ''}"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
						<path d="M13.7 21a2 2 0 0 1-3.4 0" />
					</svg>
					{#if unread.notifications > 0}<span class="badge dot">{unread.notifications}</span>{/if}
				</a>
				<a href="/profile/{encodeURIComponent(profile.username)}" class="username">
					<Avatar {profile} size={28} link={false} />
					<span class="name">{profile.username}</span>
				</a>
				<form method="POST" action="/auth/signout">
					<button class="btn btn-ghost btn-sm" type="submit">Sign out</button>
				</form>
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
		gap: 1.5rem;
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
		gap: 1.2rem;
		flex: 1;
		font-size: 0.9rem;
		font-weight: 400;
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
		gap: 0.9rem;
		margin-left: auto;
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
	.username {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		font-weight: 500;
		font-size: 0.9rem;
	}
	.username .name {
		text-shadow: var(--glow-green);
	}
	@media (max-width: 580px) {
		.nav-links,
		.username .name {
			display: none;
		}
		.nav-inner {
			gap: 0.75rem;
		}
	}
</style>
