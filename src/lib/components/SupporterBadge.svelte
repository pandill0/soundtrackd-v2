<script lang="ts">
	import { isSupporter } from '$lib/entitlements';
	import type { ProfileCard } from '$lib/types';
	let { profile, small = false }: { profile: Partial<ProfileCard> | null | undefined; small?: boolean } = $props();
</script>

{#if isSupporter(profile)}
	<span class="tag gold" class:tiny={small} title="Supports Soundtrackd">♥ supporter</span>
{/if}
