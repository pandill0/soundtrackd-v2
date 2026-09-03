<script lang="ts">
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import { timeAgo } from '$lib/utils';

	let { data } = $props();
</script>

<svelte:head><title>Messages · Soundtrackd</title></svelte:head>

<div class="container page narrow">
	<div class="section-head">
		<h1>Messages</h1>
		<a class="muted small" href="/friends">Friends →</a>
	</div>
	{#if data.conversations.length}
		<div class="list">
			{#each data.conversations as c (c.conversation_id)}
				<a class="list-row conv" class:unread={c.unread > 0} href="/messages/{c.conversation_id}">
					<Avatar profile={{ id: c.other_id, username: c.other_username, avatar_url: c.other_avatar, accent_color: c.other_accent, supporter_until: c.other_supporter_until }} size={44} link={false} />
					<div class="grow truncate">
						<div class="row"><span class="name">{c.other_username}</span>{#if c.other_status_text}<span class="muted tiny truncate">{c.other_status_emoji ?? ''} {c.other_status_text}</span>{/if}</div>
						<div class="preview truncate" class:muted={!c.unread}>
							{#if c.last_sender_id === page.data.user?.id}<span class="muted">You: </span>{/if}{c.last_shared_item_id ? '🎵 ' : ''}{c.last_body ?? 'Say hi'}
						</div>
					</div>
					<div class="right">
						<span class="muted tiny">{c.last_at ? timeAgo(c.last_at) : ''}</span>
						{#if c.unread > 0}<span class="badge">{c.unread}</span>{/if}
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty">
			No conversations yet. Messages are between friends — send a record to someone.
			<br /><a class="btn btn-sm btn-primary" href="/friends">Go to friends</a>
		</div>
	{/if}
</div>

<style>
	.narrow {
		max-width: 620px;
	}
	.conv {
		padding: 0.75rem 0.5rem;
		border-radius: var(--radius-sm);
	}
	.conv:hover {
		background: var(--surface);
	}
	.conv.unread .name,
	.conv.unread .preview {
		color: var(--text);
		font-weight: 500;
	}
	.name {
		font-weight: 500;
	}
	.preview {
		font-size: 0.88rem;
	}
	.right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}
</style>
