<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let username = $state((form?.username as string | undefined) ?? data.suggestion ?? '');
	let status = $state<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	function check() {
		clearTimeout(timer);
		const value = username.trim();
		if (!/^[A-Za-z0-9_]{3,20}$/.test(value)) {
			status = value ? 'invalid' : 'idle';
			return;
		}
		status = 'checking';
		timer = setTimeout(async () => {
			const r = await fetch(`/api/username?u=${encodeURIComponent(value)}`).then((r) => r.json());
			status = r.available ? 'free' : 'taken';
		}, 350);
	}
</script>

<svelte:head><title>Choose your username · Soundtrackd</title></svelte:head>

<div class="container page welcome">
	<div class="card">
		<div class="eyebrow">One last thing</div>
		<h1 class="serif">Pick a username</h1>
		<p class="muted">
			You signed in with <strong>{data.email}</strong>. Your username is how people find and follow you.
			It can't be changed later, so choose one you like.
		</p>

		<form method="POST" class="stack" use:enhance>
			<div class="field">
				<label for="username">Username</label>
				<input
					class="input"
					id="username"
					name="username"
					bind:value={username}
					oninput={check}
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					required
					minlength="3"
					maxlength="20"
				/>
				<span class="hint" class:accent={status === 'free'} class:danger={status === 'taken' || status === 'invalid'}>
					{#if status === 'checking'}Checking…{:else if status === 'free'}✓ {username} is available{:else if status === 'taken'}That one's taken{:else if status === 'invalid'}3–20 letters, numbers or underscores{:else}3–20 letters, numbers or underscores{/if}
				</span>
			</div>
			{#if form?.error}<p class="error-msg">{form.error}</p>{/if}
			<button class="btn btn-primary" type="submit" disabled={status === 'taken' || status === 'invalid'}>Continue</button>
		</form>
	</div>
</div>

<style>
	.welcome {
		max-width: 520px;
	}
	.card {
		padding: 2rem;
	}
	h1 {
		margin: 0.25rem 0 0.5rem;
	}
	p {
		margin-bottom: 1.25rem;
	}
</style>
