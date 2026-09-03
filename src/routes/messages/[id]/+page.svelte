<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import Picker from '$lib/components/Picker.svelte';
	import SupporterBadge from '$lib/components/SupporterBadge.svelte';
	import { getBrowserClient } from '$lib/supabase/client';
	import { openRateModal } from '$lib/rate-modal.svelte';
	import type { CatalogItem, Message } from '$lib/types';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let messages = $state<Message[]>(data.messages);
	// svelte-ignore state_referenced_locally
	let items = $state<Record<string, CatalogItem>>({ ...data.itemMap });
	let draft = $state('');
	let attached = $state<CatalogItem | null>(null);
	let picking = $state(false);
	let sending = $state(false);
	let err = $state('');
	let scroller: HTMLDivElement | undefined = $state();
	const me = $derived(page.data.user?.id);

	async function scrollDown() {
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight });
	}

	onMount(() => {
		scrollDown();
		const supabase = getBrowserClient();
		if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
		const channel = supabase
			.channel(`conv:${data.conversationId}`)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${data.conversationId}` },
				async (payload) => {
					const m = payload.new as Message;
					if (messages.some((x) => x.id === m.id)) return;
					if (m.shared_item_id && !items[m.shared_item_id]) {
						const item = await fetch(`/api/catalog/item?id=${m.shared_item_id}`).then((r) => (r.ok ? r.json() : null));
						if (item) items[m.shared_item_id] = item;
					}
					messages = [...messages, m];
					scrollDown();
					if (m.sender_id !== me) {
						fetch('/api/messages/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversation_id: data.conversationId }) });
						invalidate('app:unread');
					}
				}
			)
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${data.conversationId}` }, (payload) => {
				const m = payload.new as Message;
				messages = messages.map((x) => (x.id === m.id ? m : x));
			})
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	});

	async function send() {
		const body = draft.trim();
		if ((!body && !attached) || sending) return;
		sending = true;
		err = '';
		const res = await fetch('/api/messages', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ conversation_id: data.conversationId, body, shared_item_id: attached?.id ?? null })
		});
		if (res.ok) {
			const m = (await res.json()) as Message;
			if (attached) items[attached.id] = attached;
			if (!messages.some((x) => x.id === m.id)) messages = [...messages, m];
			draft = '';
			attached = null;
			scrollDown();
		} else {
			err = (await res.json().catch(() => ({}))).message ?? 'Could not send';
		}
		sending = false;
	}

	async function report(m: Message) {
		const reason = prompt('Why are you reporting this message?');
		if (reason === null) return;
		await fetch('/api/messages/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message_id: m.id, reason }) });
		alert('Thanks — reported.');
	}
	async function remove(m: Message) {
		if (!confirm('Delete this message?')) return;
		await fetch('/api/messages', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id }) });
		messages = messages.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: '[deleted]', shared_item_id: null } : x));
	}
	async function block() {
		if (!confirm(`Block ${data.other.username}? They won't be able to message or friend you.`)) return;
		await fetch('/api/friend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'block', user_id: data.other.id }) });
		location.href = '/messages';
	}
	function rateShared(item: CatalogItem) {
		openRateModal({ kind: item.kind === 'track' ? 'track' : 'album', id: item.id, title: item.title, artist: item.artist_name, cover: item.cover_url, albumId: item.parent_id });
	}
</script>

<svelte:head><title>{data.other.username} · Messages · Soundtrackd</title></svelte:head>

<div class="container page chat-page">
	<header class="chat-head">
		<a class="back muted" href="/messages" aria-label="Back to messages">←</a>
		<Avatar profile={data.other} size={40} />
		<div class="grow truncate">
			<a class="name" href="/profile/{encodeURIComponent(data.other.username)}">{data.other.username}</a> <SupporterBadge profile={data.other} small />
			<div class="muted tiny truncate">{#if data.other.status_text}{data.other.status_emoji ?? ''} {data.other.status_text}{:else if data.other.last_seen_at}seen {timeAgo(data.other.last_seen_at)}{/if}</div>
		</div>
		<button class="btn btn-xs btn-ghost" onclick={block}>Block</button>
	</header>

	<div class="thread" bind:this={scroller}>
		{#if !messages.length}
			<p class="muted small center">Start of your conversation with {data.other.username}. Send them a record.</p>
		{/if}
		{#each messages as m (m.id)}
			{@const mine = m.sender_id === me}
			{@const item = m.shared_item_id ? items[m.shared_item_id] : null}
			<div class="msg" class:mine>
				<div class="bubble" class:deleted={m.deleted_at}>
					{#if item}
						<div class="record">
							<a href={item.kind === 'track' ? `/song/${item.id}` : `/album/${item.id}`}>
								{#if item.cover_url}<img src={item.cover_url} alt="" width="56" height="56" />{/if}
							</a>
							<div class="grow truncate">
								<a class="rt truncate" href={item.kind === 'track' ? `/song/${item.id}` : `/album/${item.id}`}>{item.title}</a>
								<div class="muted tiny truncate">{[item.artist_name, item.release_year].filter(Boolean).join(' · ')}</div>
								<button class="btn btn-xs" onclick={() => rateShared(item)}>★ Rate</button>
							</div>
						</div>
					{/if}
					{#if m.body && m.body !== '🎵'}<div class="text prose">{m.body}</div>{/if}
					<div class="meta tiny">
						{timeAgo(m.created_at)}
						{#if !m.deleted_at}
							{#if mine}<button onclick={() => remove(m)}>delete</button>{:else}<button onclick={() => report(m)}>report</button>{/if}
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if data.blocked}
		<p class="muted small center">You can't message each other.</p>
	{:else}
		<form class="composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
			{#if attached}
				<div class="attached">
					{#if attached.cover_url}<img src={attached.cover_url} alt="" width="32" height="32" />{/if}
					<span class="truncate grow small">{attached.title}{#if attached.artist_name}<span class="muted"> · {attached.artist_name}</span>{/if}</span>
					<button type="button" class="muted" onclick={() => (attached = null)} aria-label="Remove">✕</button>
				</div>
			{/if}
			{#if err}<p class="error-msg small">{err}</p>{/if}
			<div class="row">
				<button type="button" class="btn btn-icon" onclick={() => (picking = true)} title="Send a record" aria-label="Send a record">🎵</button>
				<input class="input grow" placeholder="Message {data.other.username}…" bind:value={draft} maxlength="4000" onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} />
				<button class="btn btn-primary" type="submit" disabled={sending || (!draft.trim() && !attached)}>Send</button>
			</div>
		</form>
	{/if}
</div>

{#if picking}
	<Picker kind="all" title="Send a record" onpick={(i) => { attached = i; picking = false; }} onclose={() => (picking = false)} />
{/if}

<style>
	.chat-page {
		max-width: 680px;
		display: flex;
		flex-direction: column;
		height: calc(100vh - var(--nav-h));
		padding-bottom: 1rem;
	}
	.chat-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.back {
		font-size: 1.2rem;
		padding: 0 0.25rem;
	}
	.name {
		font-weight: 500;
	}
	.thread {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.msg {
		display: flex;
	}
	.msg.mine {
		justify-content: flex-end;
	}
	.bubble {
		max-width: 78%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px 14px 14px 4px;
		padding: 0.55rem 0.8rem;
		font-size: 0.93rem;
	}
	.mine .bubble {
		background: rgba(74, 158, 107, 0.16);
		border-color: rgba(74, 158, 107, 0.3);
		border-radius: 14px 14px 4px 14px;
	}
	.bubble.deleted .text {
		color: var(--muted);
		font-style: italic;
	}
	.record {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		background: var(--surface2);
		border-radius: 8px;
		padding: 0.4rem;
		margin-bottom: 0.4rem;
		min-width: 220px;
	}
	.record img {
		width: 56px;
		height: 56px;
		border-radius: 6px;
	}
	.rt {
		display: block;
		font-weight: 500;
	}
	.meta {
		margin-top: 0.25rem;
		color: var(--muted);
		display: flex;
		gap: 0.5rem;
	}
	.meta button {
		color: var(--muted);
		font-size: inherit;
	}
	.meta button:hover {
		color: var(--danger);
	}
	.composer {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.attached {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--surface2);
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.5rem;
	}
	.attached img {
		border-radius: 4px;
	}
	@media (max-width: 580px) {
		.chat-page {
			height: calc(100vh - var(--nav-h) - 64px);
		}
		.bubble {
			max-width: 90%;
		}
	}
</style>
