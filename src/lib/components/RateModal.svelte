<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { RATING_STEPS, STAR_PATH, ratingLabel, starString } from '$lib/stars';
	import { rateModal, closeRateModal } from '$lib/rate-modal.svelte';

	const uid = $props.id();
	let value = $state(0);
	let preview = $state(0);
	let review = $state('');
	let saving = $state(false);
	let error = $state('');

	// Reset the form each time the modal opens for a new target.
	$effect(() => {
		if (rateModal.open) {
			value = rateModal.existing?.rating ?? 0;
			review = rateModal.existing?.review ?? '';
			preview = 0;
			error = '';
		}
	});

	const shown = $derived(preview || value);
	const label = $derived(shown ? `${starString(shown)} — ${ratingLabel(shown)}` : 'Tap a star to rate');

	/** Mouse position inside a star decides half vs full (§9). */
	function valueFromEvent(e: MouseEvent | TouchEvent, starIndex: number): number {
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const x = 'touches' in e ? (e.touches[0]?.clientX ?? rect.left + rect.width) : e.clientX;
		const half = x - rect.left < rect.width / 2;
		return starIndex + (half ? 0.5 : 1);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			value = Math.min(5, (value || 0) + 0.5);
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			value = Math.max(0.5, (value || 0.5) - 0.5);
			e.preventDefault();
		} else if (e.key === 'Escape') {
			closeRateModal();
		}
	}

	async function save() {
		if (!rateModal.target) return;
		if (!page.data.user) {
			closeRateModal();
			goto(`/login?next=${encodeURIComponent(page.url.pathname)}`);
			return;
		}
		if (!RATING_STEPS.includes(value as (typeof RATING_STEPS)[number])) {
			error = 'Pick a rating first — a review needs a rating (§9).';
			return;
		}
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/rate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					kind: rateModal.target.kind,
					id: rateModal.target.id,
					albumId: rateModal.target.albumId ?? null,
					rating: value,
					review: review.trim() || null
				})
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Could not save');
			rateModal.onSaved?.({ rating: value, review: review.trim() || null });
			closeRateModal();
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save your rating';
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!rateModal.target || !confirm('Remove your rating and review?')) return;
		saving = true;
		try {
			const res = await fetch('/api/rate', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: rateModal.target.kind, id: rateModal.target.id })
			});
			if (!res.ok) throw new Error('Could not remove');
			rateModal.onSaved?.(null);
			closeRateModal();
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not remove your rating';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => rateModal.open && e.key === 'Escape' && closeRateModal()} />

{#if rateModal.open && rateModal.target}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && closeRateModal()}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rate-title">
			<div class="modal-head">
				<div class="row">
					{#if rateModal.target.cover}
						<img class="thumb lg" src={rateModal.target.cover} alt="" />
					{/if}
					<div>
						<div class="eyebrow">{rateModal.existing ? 'Edit your rating' : `Rate this ${rateModal.target.kind}`}</div>
						<h3 id="rate-title">{rateModal.target.title}</h3>
						{#if rateModal.target.artist}<div class="muted small">{rateModal.target.artist}</div>{/if}
					</div>
				</div>
				<button class="modal-close" onclick={closeRateModal} aria-label="Close">×</button>
			</div>

			<div
				class="star-picker"
				role="slider"
				tabindex="0"
				aria-label="Rating"
				aria-valuemin="0.5"
				aria-valuemax="5"
				aria-valuenow={value || 0}
				aria-valuetext={label}
				onkeydown={onKey}
				onmouseleave={() => (preview = 0)}
			>
				{#each [0, 1, 2, 3, 4] as i (i)}
					{@const fill = Math.max(0, Math.min(1, shown - i))}
					<button
						type="button"
						class="star"
						tabindex="-1"
						aria-hidden="true"
						onmousemove={(e) => (preview = valueFromEvent(e, i))}
						onclick={(e) => {
							value = valueFromEvent(e, i);
							preview = 0;
						}}
						ontouchstart={(e) => (preview = valueFromEvent(e, i))}
						ontouchend={() => {
							if (preview) value = preview;
							preview = 0;
						}}
					>
						<svg viewBox="0 0 20 20" class="glyph" class:lit={fill > 0}>
							<defs><clipPath id="rate-{uid}-{i}"><rect x="0" y="0" width={fill * 20} height="20" /></clipPath></defs>
							<path d={STAR_PATH} class="empty" />
							<path d={STAR_PATH} class="fill" clip-path="url(#rate-{uid}-{i})" />
						</svg>
					</button>
				{/each}
			</div>
			<div class="label" class:muted={!shown}>{label}</div>

			<div class="field">
				<label for="review">Review <span class="muted">(optional)</span></label>
				<textarea
					id="review"
					class="textarea"
					bind:value={review}
					maxlength="4000"
					placeholder="What did you think?"
				></textarea>
			</div>

			{#if error}<p class="error-msg">{error}</p>{/if}

			<div class="actions">
				{#if rateModal.existing}
					<button class="btn btn-danger btn-sm" onclick={remove} disabled={saving}>Remove</button>
				{/if}
				<span class="grow"></span>
				<button class="btn btn-ghost" onclick={closeRateModal} disabled={saving}>Cancel</button>
				<button class="btn btn-primary" onclick={save} disabled={saving || !value}>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.star-picker {
		display: flex;
		justify-content: center;
		gap: 0.15rem;
		margin: 0.75rem 0 0.25rem;
		outline: none;
		border-radius: var(--radius-sm);
	}
	.star-picker:focus-visible {
		box-shadow: 0 0 0 2px rgba(74, 158, 107, 0.5);
	}
	.star {
		padding: 0 0.1rem;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		line-height: 0;
	}
	.glyph {
		width: 2.6rem;
		height: 2.6rem;
		transition: transform 0.1s;
	}
	.glyph.lit {
		filter: drop-shadow(0 0 6px rgba(200, 169, 110, 0.45));
	}
	.star:hover .glyph {
		transform: scale(1.08);
	}
	.glyph .empty {
		fill: var(--surface2);
	}
	.glyph .fill {
		fill: var(--star);
	}
	.label {
		text-align: center;
		font-family: var(--font-serif);
		font-size: 1.1rem;
		color: var(--star);
		min-height: 1.6em;
		margin-bottom: 1rem;
	}
	.label.muted {
		color: var(--muted);
		font-family: var(--font-sans);
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 1.25rem;
		align-items: center;
	}
</style>
