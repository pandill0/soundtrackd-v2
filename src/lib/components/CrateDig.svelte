<script lang="ts">
	import { onMount } from 'svelte';
	import { coverSize } from '$lib/utils';

	/**
	 * A crate of records being flipped through (§3, music-native graphics). Pure CSS 3D:
	 * every few seconds the front sleeve tips forward and slides to the back of the box.
	 * Static under prefers-reduced-motion.
	 */
	let { covers = [] }: { covers: string[] } = $props();

	// svelte-ignore state_referenced_locally
	let order = $state(covers.slice(0, 8));
	let flipping = $state(false);

	onMount(() => {
		if (order.length < 3 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let inner = 0;
		const outer = setInterval(() => {
			if (document.hidden) return;
			flipping = true;
			inner = window.setTimeout(() => {
				order = [...order.slice(1), order[0]];
				flipping = false;
			}, 850);
		}, 2600);
		return () => {
			clearInterval(outer);
			clearTimeout(inner);
		};
	});
</script>

{#if order.length}
	<div class="crate" aria-hidden="true">
		<div class="box back"></div>
		{#each order as url, i (url)}
			<img src={coverSize(url, 250)} alt="" class="sleeve" class:flip={flipping && i === 0} style="--i:{i}" draggable="false" />
		{/each}
		<div class="box front"></div>
	</div>
{/if}

<style>
	.crate {
		position: relative;
		width: 230px;
		height: 180px;
		perspective: 800px;
		perspective-origin: 50% 30%;
		flex-shrink: 0;
	}
	.box {
		position: absolute;
		left: 8px;
		right: 8px;
		height: 96px;
		bottom: 8px;
		border-radius: 6px;
		background: linear-gradient(#1a2119, #0f150f);
		border: 1px solid rgba(255, 255, 255, 0.08);
		transform-origin: bottom;
	}
	.box.back {
		transform: translateZ(-110px) translateY(-26px) rotateX(-10deg);
		filter: brightness(0.6);
		z-index: 0;
	}
	.box.front {
		transform: translateZ(28px) rotateX(-10deg);
		z-index: 20;
		box-shadow: 0 14px 30px rgba(0, 0, 0, 0.55);
		background: linear-gradient(#232c24, #131a14);
		pointer-events: none;
	}
	.sleeve {
		position: absolute;
		left: 50%;
		bottom: 34px;
		width: 130px;
		height: 130px;
		border-radius: 3px;
		object-fit: cover;
		transform-origin: 50% 100%;
		transform: translateX(-50%) translateZ(calc(var(--i) * -14px)) translateY(calc(var(--i) * -4px)) rotateX(-14deg);
		z-index: calc(19 - var(--i));
		filter: brightness(calc(1 - var(--i) * 0.08));
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
		transition: transform 0.55s ease, filter 0.55s ease;
		user-select: none;
	}
	.sleeve.flip {
		animation: flip 0.85s ease-in-out forwards;
		z-index: 21;
	}
	@keyframes flip {
		0% {
			transform: translateX(-50%) translateZ(0) translateY(0) rotateX(-14deg);
		}
		45% {
			transform: translateX(-50%) translateZ(30px) translateY(-70px) rotateX(-70deg);
			filter: brightness(1.05);
		}
		100% {
			transform: translateX(-50%) translateZ(-112px) translateY(-32px) rotateX(-14deg);
			filter: brightness(0.44);
		}
	}
</style>
