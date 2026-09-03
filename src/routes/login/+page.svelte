<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, form } = $props();

	type Mode = 'signin' | 'signup' | 'reset';
	let mode = $state<Mode>(data.mode as Mode);
	let busy = $state(false);
	let remember = $state(true);

	const message = $derived(form?.success ? form.message : data.message);
	const error = $derived(form && !form.success && form.action !== 'google' ? form.error : null);
	const googleError = $derived(form?.action === 'google' ? form.error : null);
</script>

<svelte:head>
	<title>{mode === 'signup' ? 'Create account' : 'Sign in'} · Soundtrackd</title>
</svelte:head>

<div class="container page auth-page">
	<div class="auth-card card">
		<h1 class="serif">{mode === 'signup' ? 'Join Soundtrackd' : mode === 'reset' ? 'Reset password' : 'Welcome back'}</h1>
		<p class="muted small lede">
			{#if mode === 'signup'}Rate what you hear. Follow people with taste. Find the next record.{:else if mode === 'reset'}We'll email you a link to set a new password.{:else}Sign in to your listening life.{/if}
		</p>

		{#if message}<p class="success-msg box">{message}</p>{/if}
		{#if error}<p class="error-msg box">{error}</p>{/if}

		{#if mode !== 'reset'}
			<form method="POST" action="?/google" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
				<input type="hidden" name="next" value={data.next} />
				<input type="hidden" name="remember" value={remember ? 'on' : 'off'} />
				<button class="btn google" type="submit" disabled={busy}>
					<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-3.9-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
					Continue with Google
				</button>
				{#if googleError}<p class="error-msg small">{googleError}</p>{/if}
			</form>
			<div class="or"><span>or with email</span></div>
		{/if}

		{#if mode === 'signin'}
			<form method="POST" action="?/signin" class="stack" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
				<input type="hidden" name="next" value={data.next} />
				<div class="field">
					<label for="email">Email</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<div class="field">
					<label for="password">Password</label>
					<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
				</div>
				<div class="spread">
					<label class="checkbox"><input type="checkbox" name="remember" bind:checked={remember} /> Remember me on this device</label>
					<button type="button" class="linkish small" onclick={() => (mode = 'reset')}>Forgot password?</button>
				</div>
				<button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
			</form>
			<p class="muted small switch">New here? <button type="button" class="linkish" onclick={() => (mode = 'signup')}>Create an account</button></p>
		{:else if mode === 'signup'}
			<form method="POST" action="?/signup" class="stack" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
				<input type="hidden" name="next" value={data.next} />
				<div class="field">
					<label for="username">Username</label>
					<input class="input" id="username" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" value={form?.username ?? ''} />
					<span class="hint">3–20 characters. Letters, numbers, underscores. This is how people find you.</span>
				</div>
				<div class="field">
					<label for="s-email">Email</label>
					<input class="input" id="s-email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<div class="field">
					<label for="s-password">Password</label>
					<input class="input" id="s-password" name="password" type="password" autocomplete="new-password" required minlength="8" />
					<span class="hint">At least 8 characters.</span>
				</div>
				<label class="checkbox"><input type="checkbox" name="remember" bind:checked={remember} /> Remember me on this device</label>
				<button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
			</form>
			<p class="muted small switch">Already a member? <button type="button" class="linkish" onclick={() => (mode = 'signin')}>Sign in</button></p>
		{:else}
			<form method="POST" action="?/reset" class="stack" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
				<div class="field">
					<label for="r-email">Email</label>
					<input class="input" id="r-email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				<button class="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
			</form>
			<p class="muted small switch"><button type="button" class="linkish" onclick={() => (mode = 'signin')}>← Back to sign in</button></p>
		{/if}
	</div>
	<p class="muted tiny center shared">
		On a shared computer? Leave "Remember me" unchecked and your session ends when the browser closes.
		{#if page.url.searchParams.get('next')}<br />You'll be sent back to where you were.{/if}
	</p>
</div>

<style>
	.auth-page {
		max-width: 480px;
	}
	.auth-card {
		padding: 2rem;
	}
	.auth-card h1 {
		font-size: 1.9rem;
		margin-bottom: 0.25rem;
	}
	.lede {
		margin-bottom: 1.25rem;
	}
	.box {
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface2);
		margin-bottom: 1rem;
	}
	.google {
		width: 100%;
		background: #fff;
		color: #1a1a1a;
		border-color: #fff;
		font-weight: 600;
	}
	.google:hover {
		background: #f1f1f1;
	}
	.or {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--muted);
		font-size: 0.75rem;
		margin: 1.1rem 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		border-top: 1px solid var(--border);
	}
	.linkish {
		color: var(--accent);
		padding: 0;
		font: inherit;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	.switch {
		margin-top: 1.25rem;
		text-align: center;
	}
	.shared {
		margin-top: 1.25rem;
	}
</style>
