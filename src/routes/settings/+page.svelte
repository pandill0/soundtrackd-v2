<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const p = $derived(data.profile);

	// svelte-ignore state_referenced_locally
	let tab = $state((form?.tab as string | undefined) ?? data.tab);
	// svelte-ignore state_referenced_locally
	let statusLen = $state(p.status_text?.length ?? 0);

	const tabs = [
		['profile', 'Profile'],
		['status', 'Status'],
		['password', 'Password']
	];
</script>

<svelte:head><title>Settings · Soundtrackd</title></svelte:head>

<div class="container page settings">
	<div class="eyebrow">Settings</div>
	<h1>Your profile</h1>
	<p class="muted small">Signed in as <strong>{p.username}</strong> · {data.email}. Usernames are permanent. Favourite albums and artists are edited <a class="link" href="/profile/{encodeURIComponent(p.username)}">on your profile</a>.</p>

	<nav class="tabs" aria-label="Settings sections">
		{#each tabs as [id, label] (id)}
			<button class="tab" class:active={tab === id} onclick={() => (tab = id)}>{label}</button>
		{/each}
	</nav>

	{#if form?.success && form.tab === tab}<p class="success-msg box">{form.success}</p>{/if}
	{#if form?.error && form.tab === tab}<p class="error-msg box">{form.error}</p>{/if}

	{#if tab === 'profile'}
		<form method="POST" action="?/profile" class="stack card" use:enhance>
			<div class="field"><label for="bio">Bio</label><textarea class="textarea" id="bio" name="bio" maxlength="1000" placeholder="A few words about your taste.">{p.bio ?? ''}</textarea></div>
			<div class="two">
				<div class="field"><label for="pronouns">Pronouns</label><input class="input" id="pronouns" name="pronouns" maxlength="40" value={p.pronouns ?? ''} placeholder="they/them" /></div>
				<div class="field"><label for="website">Website</label><input class="input" id="website" name="website" maxlength="200" value={p.website ?? ''} placeholder="yoursite.com" /></div>
			</div>
			<div class="field"><label for="avatar">Avatar image URL</label><input class="input" id="avatar" name="avatar_url" maxlength="500" value={p.avatar_url ?? ''} placeholder="https://…/you.jpg" /><span class="hint">Paste a link to a square image. (Uploads are coming.)</span></div>
			<div class="field"><label for="lb">ListenBrainz username</label><input class="input" id="lb" name="listenbrainz_user" maxlength="64" value={p.listenbrainz_user ?? ''} placeholder="optional" /><span class="hint">Lets Soundtrackd show what you're listening to, automatically. Free and open — listenbrainz.org.</span></div>
			<label class="checkbox"><input type="checkbox" name="queue_public" checked={(p as { queue_public?: boolean }).queue_public ?? false} /> Make my listen queue public</label>
			{#if data.supporter}
				<div class="field"><label for="accent">Profile accent colour <span class="tag gold">supporter</span></label><div class="row"><input type="color" id="accent" name="accent_color" value={p.accent_color ?? '#4a9e6b'} /><span class="hint">Tints your name and avatar ring across the site.</span></div></div>
			{:else}
				<p class="hint">A custom accent colour is a <a class="link" href="/support">supporter</a> perk.</p>
			{/if}
			<div><button class="btn btn-primary" type="submit">Save profile</button></div>
		</form>
	{:else if tab === 'status'}
		<form method="POST" action="?/status" class="stack card" use:enhance>
			<div class="two emoji-row">
				<div class="field"><label for="emoji">Emoji</label><input class="input" id="emoji" name="status_emoji" maxlength="8" value={p.status_emoji ?? ''} placeholder="🎧" /></div>
				<div class="field grow"><label for="status">Status <span class="muted">({statusLen}/140)</span></label><input class="input" id="status" name="status_text" maxlength="140" value={p.status_text ?? ''} placeholder="deep in a shoegaze phase" oninput={(e) => (statusLen = e.currentTarget.value.length)} /></div>
			</div>
			<div class="field"><label for="expires">Clear after</label>
				<select class="select" id="expires" name="expires">
					<option value="0">Don't clear</option>
					<option value="1">1 hour</option>
					<option value="4">4 hours</option>
					<option value="24">Today</option>
					<option value="168">This week</option>
				</select>
			</div>
			<div class="row"><button class="btn btn-primary" type="submit">Set status</button>
				<button class="btn btn-ghost" type="submit" formaction="?/status" onclick={(e) => { const f = e.currentTarget.form!; (f.elements.namedItem('status_text') as HTMLInputElement).value = ''; (f.elements.namedItem('status_emoji') as HTMLInputElement).value = ''; }}>Clear</button>
			</div>
		</form>
	{:else}
		<form method="POST" action="?/password" class="stack card" use:enhance>
			{#if !data.hasPassword}<p class="hint">You signed up with Google. Setting a password also lets you sign in with email.</p>{/if}
			<div class="field"><label for="pw">New password</label><input class="input" id="pw" name="password" type="password" autocomplete="new-password" minlength="8" required /></div>
			<div class="field"><label for="pw2">Confirm</label><input class="input" id="pw2" name="confirm" type="password" autocomplete="new-password" minlength="8" required /></div>
			<div><button class="btn btn-primary" type="submit">Update password</button></div>
		</form>
	{/if}
</div>


<style>
	.settings {
		max-width: 640px;
	}
	h1 {
		margin-bottom: 0.25rem;
	}
	.tabs {
		margin-top: 1.25rem;
	}
	.box {
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface2);
		margin-bottom: 1rem;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.emoji-row {
		grid-template-columns: 90px 1fr;
	}
	input[type='color'] {
		width: 44px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface2);
		padding: 2px;
	}
	@media (max-width: 580px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
</style>
