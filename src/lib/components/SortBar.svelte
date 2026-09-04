<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	/**
	 * The one shared sort/filter control (§8.3). State lives in the URL — it survives refresh,
	 * back button and pasted links. Pages read the same params in their load functions and
	 * pass them to Postgres, which does the actual sorting.
	 */
	interface Option {
		value: string;
		label: string;
	}
	interface Filter {
		key: string;
		label: string;
		options: Option[];
	}
	let {
		sorts,
		defaultSort,
		defaultDir = 'desc',
		filters = [],
		allowDir = true
	}: { sorts: Option[]; defaultSort: string; defaultDir?: 'asc' | 'desc'; filters?: Filter[]; allowDir?: boolean } = $props();

	const params = $derived(page.url.searchParams);
	const sort = $derived(params.get('sort') ?? defaultSort);
	const dir = $derived((params.get('dir') as 'asc' | 'desc' | null) ?? defaultDir);
	const active = $derived(filters.filter((f) => params.get(f.key)));

	function set(changes: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(changes)) {
			if (v == null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, noScroll: true });
	}
</script>

<div class="sortbar" role="group" aria-label="Sort and filter">
	<label class="ctl">
		<span class="lbl">Sort</span>
		<select class="select" value={sort} onchange={(e) => set({ sort: e.currentTarget.value === defaultSort ? null : e.currentTarget.value })}>
			{#each sorts as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
		</select>
	</label>
	{#if allowDir}
		<button class="btn btn-sm btn-ghost dir" onclick={() => set({ dir: dir === 'desc' ? 'asc' : null })} title={dir === 'desc' ? 'Descending' : 'Ascending'} aria-label="Toggle direction">
			{dir === 'desc' ? '↓' : '↑'}
		</button>
	{/if}
	{#each filters as f (f.key)}
		<label class="ctl">
			<span class="lbl">{f.label}</span>
			<select class="select" value={params.get(f.key) ?? ''} onchange={(e) => set({ [f.key]: e.currentTarget.value || null })}>
				<option value="">All</option>
				{#each f.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
		</label>
	{/each}
	{#if active.length}
		<button class="btn btn-sm btn-ghost" onclick={() => set(Object.fromEntries(filters.map((f) => [f.key, null])))}>Clear</button>
	{/if}
</div>

<style>
	.sortbar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	.ctl {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.lbl {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.select {
		width: auto;
		padding: 0.35rem 1.8rem 0.35rem 0.6rem;
		font-size: 0.85rem;
	}
	.dir {
		padding: 0.35rem 0.55rem;
		font-size: 0.95rem;
	}
	@media (max-width: 580px) {
		/* iOS Safari zooms the page on focus when a field's text is under 16px */
		.select {
			font-size: 16px;
		}
	}
</style>
