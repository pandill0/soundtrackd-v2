<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import FriendButton from '$lib/components/FriendButton.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
	let q = $state('');
	let results = $state<{ id: string; username: string; avatar_url: string | null; accent_color: string | null; supporter_until: string | null }[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;

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
	async function act(action: string, body: Record<string, unknown>) {
		await fetch('/api/friend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
		await invalidateAll();
	}
</script>

<svelte:head><title>Friends · Soundtrackd</title></svelte:head>

<div class="container page friends-page">
	<div class="section-head">
		<h1>Friends</h1>
		<span class="muted small">Friends can message each other. Following is separate — that's just your feed.</span>
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
						<button class="btn btn-sm" onclick={() => act('request', { user_id: u.id })}>+ Add</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if data.incoming.length}
		<section class="section">
			<h2 class="section-title">Requests <span class="badge">{data.incoming.length}</span></h2>
			{#each data.incoming as r (r.id)}
				<div class="list-row">
					<Avatar profile={r.other} size={40} />
					<div class="grow"><a href="/profile/{encodeURIComponent(r.other.username)}">{r.other.username}</a> <span class="muted tiny">wants to be friends · {timeAgo(r.created_at)}</span></div>
					<button class="btn btn-sm btn-primary" onclick={() => act('accept', { id: r.id })}>Accept</button>
					<button class="btn btn-sm btn-ghost" onclick={() => act('decline', { id: r.id })}>Decline</button>
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
							<Avatar profile={f.other} size={44} />
							<div class="grow truncate">
								<a class="name" href="/profile/{encodeURIComponent(f.other.username)}">{f.other.username}</a> <SupporterBadge profile={f.other} small />
								{#if f.live?.status_text}<div class="small truncate">{f.live.status_emoji ?? ''} {f.live.status_text}</div>{/if}
								{#if f.live?.np_title}
									<a class="np truncate" href="/album/{f.live.now_playing_id}"><span class="disc"></span>{f.live.np_title}{#if f.live.np_artist}<span class="muted"> · {f.live.np_artist}</span>{/if}</a>
								{:else if f.live?.last_seen_at}
									<div class="muted tiny">seen {timeAgo(String(f.live.last_seen_at))}</div>
								{/if}
							</div>
						</div>
						<div class="row actions">
							<a class="btn btn-sm" href="/messages/new?to={f.other.id}">Message</a>
							<FriendButton userId={f.other.id} friendship={f} small />
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty">
				No friends yet. Friendship is mutual — send a request and they accept.
				<br /><a class="btn btn-sm btn-primary" href="/members">Browse members</a>
			</div>
		{/if}
	</section>

	{#if data.outgoing.length}
		<section class="section">
			<h2 class="section-title">Sent requests</h2>
			{#each data.outgoing as r (r.id)}
				<div class="list-row">
					<Avatar profile={r.other} size={32} />
					<a class="grow" href="/profile/{encodeURIComponent(r.other.username)}">{r.other.username}</a>
					<span class="muted tiny">{timeAgo(r.created_at)}</span>
					<button class="btn btn-sm btn-ghost" onclick={() => act('remove', { user_id: r.other.id })}>Cancel</button>
				</div>
			{/each}
		</section>
	{/if}

	{#if data.blocked.length}
		<section class="section">
			<h2 class="section-title muted">Blocked</h2>
			{#each data.blocked as r (r.id)}
				<div class="list-row">
					<Avatar profile={r.other} size={32} />
					<span class="grow muted">{r.other.username}</span>
					<button class="btn btn-sm btn-ghost" onclick={() => act('unblock', { user_id: r.other.id })}>Unblock</button>
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
