<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
	let q = $state('');
	let results = $state<{ id: string; username: string; avatar_url: string | null; accent_color: string | null; supporter_until: string | null }[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const followingIds = $derived(new Set([...data.friends, ...data.youFollow].map((p) => p.id)));
	const followerIds = $derived(new Set([...data.friends, ...data.followsYou].map((p) => p.id)));

	function search() {
		clearTimeout(timer);
		if (q.trim().length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			results = await fetch(`/api/members?q=${encodeURIComponent(q)}`).then((r) => r.json());
		}, 300);
	}
	async function unblock(id: string) {
		await fetch('/api/friend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'unblock', user_id: id }) });
		await invalidateAll();
	}
</script>

<svelte:head><title>Friends · Soundtrackd</title></svelte:head>

<div class="container page friends-page">
	<div class="section-head">
		<h1>Friends</h1>
		<span class="muted small">Follow someone to see their activity. When they follow you back, you're friends and can message.</span>
	</div>

	<div class="card add">
		<label class="label" for="find">Find someone</label>
		<input class="input" id="find" placeholder="Search members by username…" bind:value={q} oninput={search} autocomplete="off" />
		{#if results.length}
			<div class="results">
				{#each results as u (u.id)}
					<div class="list-row">
						<Avatar profile={u} size={32} />
						<a class="grow" href="/profile/{encodeURIComponent(u.username)}">{u.username}</a>
						<FollowButton userId={u.id} following={followingIds.has(u.id)} followsMe={followerIds.has(u.id)} small menu={false} />
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if data.followsYou.length}
		<section class="section">
			<h2 class="section-title">Follows you <span class="badge">{data.followsYou.length}</span></h2>
			<p class="muted small">Follow back and you're friends.</p>
			{#each data.followsYou as p (p.id)}
				<div class="list-row">
					<Avatar profile={p} size={40} />
					<div class="grow truncate"><a href="/profile/{encodeURIComponent(p.username)}">{p.username}</a> <SupporterBadge profile={p} small /><div class="muted tiny">since {timeAgo(p.since)}</div></div>
					<FollowButton userId={p.id} following={false} followsMe small menu={false} />
				</div>
			{/each}
		</section>
	{/if}

	<section class="section">
		<h2 class="section-title">Your friends <span class="muted small">({data.friends.length})</span></h2>
		{#if data.friends.length}
			<div class="grid">
				{#each data.friends as f (f.id)}
					<div class="card tight friend">
						<div class="row">
							<Avatar profile={f} size={44} />
							<div class="grow truncate">
								<a class="name" href="/profile/{encodeURIComponent(f.username)}">{f.username}</a> <SupporterBadge profile={f} small />
								{#if f.live?.status_text}<div class="small truncate">{f.live.status_emoji ?? ''} {f.live.status_text}</div>{/if}
								{#if f.live?.np_title}
									<a class="np truncate" href="/album/{f.live.now_playing_id}"><span class="disc"></span>{f.live.np_title}{#if f.live.np_artist}<span class="muted"> · {f.live.np_artist}</span>{/if}</a>
								{:else if f.live?.last_seen_at}
									<div class="muted tiny">seen {timeAgo(String(f.live.last_seen_at))}</div>
								{/if}
							</div>
						</div>
						<div class="row actions">
							<a class="btn btn-sm" href="/messages/new?to={f.id}">Message</a>
							<FollowButton userId={f.id} following followsMe small />
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty">
				No friends yet. Follow people you like; when they follow back, they show up here.
				<br /><a class="btn btn-sm btn-primary" href="/members">Browse members</a>
			</div>
		{/if}
	</section>

	{#if data.youFollow.length}
		<section class="section">
			<h2 class="section-title">You follow <span class="muted small">({data.youFollow.length})</span></h2>
			{#each data.youFollow as p (p.id)}
				<div class="list-row">
					<Avatar profile={p} size={32} />
					<a class="grow truncate" href="/profile/{encodeURIComponent(p.username)}">{p.username}</a>
					<FollowButton userId={p.id} following small menu={false} />
				</div>
			{/each}
		</section>
	{/if}

	{#if data.blocked.length}
		<section class="section">
			<h2 class="section-title muted">Blocked</h2>
			{#each data.blocked as p (p.id)}
				<div class="list-row">
					<Avatar profile={p} size={32} link={false} />
					<span class="grow muted">{p.username}</span>
					<button class="btn btn-sm btn-ghost" onclick={() => unblock(p.id)}>Unblock</button>
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.add {
		margin-bottom: 0.5rem;
	}
	.results {
		margin-top: 0.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	.friend {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.name {
		font-weight: 500;
	}
	.np {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--accent);
	}
	.disc {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--star) 0 22%, #111 24% 100%);
		animation: spin 2.4s linear infinite;
		flex-shrink: 0;
	}
	.actions {
		justify-content: flex-end;
	}
</style>
