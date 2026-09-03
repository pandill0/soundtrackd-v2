<script lang="ts">
	/**
	 * A slowly turning record with a tonearm that tracks the scroll (REBUILD-SPEC §3, "3D and
	 * music-native graphics"). Canvas 2D on a CSS perspective tilt: no library, ~0 KB.
	 *  • Never blocks first paint: the canvas initialises after mount; a static CSS disc is the poster.
	 *  • prefers-reduced-motion → one static frame, no animation loop.
	 *  • Narrow screens → static frame too (no GPU spinning in a pocket).
	 *  • Pauses when off-screen or the tab is hidden.
	 */
	import { onMount } from 'svelte';

	let { cover = null, size = 420 }: { cover?: string | null; size?: number } = $props();
	let canvas: HTMLCanvasElement | undefined = $state();
	let ready = $state(false);

	onMount(() => {
		const el = canvas;
		if (!el) return;
		const ctx = el.getContext('2d');
		if (!ctx) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		el.width = size * dpr;
		el.height = size * dpr;
		ctx.scale(dpr, dpr);

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const narrow = window.matchMedia('(max-width: 700px)').matches;
		const animate = !reduced && !narrow;

		let label: HTMLImageElement | null = null;
		if (cover) {
			label = new Image();
			label.crossOrigin = 'anonymous';
			label.src = cover;
			label.onload = () => draw(angle, arm);
			label.onerror = () => (label = null);
		}

		const R = size / 2;
		const cx = R;
		const cy = R;
		let angle = 0;
		let arm = 0; // 0 = outer groove, 1 = run-out groove
		let sheen = 0;
		let raf = 0;
		let last = performance.now();
		let visible = true;
		let hidden = document.hidden;

		function draw(a: number, t: number) {
			ctx!.clearRect(0, 0, size, size);
			// platter shadow
			ctx!.save();
			ctx!.shadowColor = 'rgba(0,0,0,0.6)';
			ctx!.shadowBlur = 40;
			ctx!.shadowOffsetY = 18;
			ctx!.fillStyle = '#0b0b0b';
			ctx!.beginPath();
			ctx!.arc(cx, cy, R * 0.96, 0, Math.PI * 2);
			ctx!.fill();
			ctx!.restore();

			ctx!.save();
			ctx!.translate(cx, cy);
			ctx!.rotate(a);
			// disc
			const disc = ctx!.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 0.96);
			disc.addColorStop(0, '#171717');
			disc.addColorStop(1, '#050505');
			ctx!.fillStyle = disc;
			ctx!.beginPath();
			ctx!.arc(0, 0, R * 0.96, 0, Math.PI * 2);
			ctx!.fill();
			// grooves
			for (let r = R * 0.38; r < R * 0.94; r += 3.2) {
				ctx!.beginPath();
				ctx!.arc(0, 0, r, 0, Math.PI * 2);
				ctx!.strokeStyle = `rgba(255,255,255,${(Math.floor(r / 3.2) % 3 === 0 ? 0.055 : 0.025).toFixed(3)})`;
				ctx!.lineWidth = 1;
				ctx!.stroke();
			}
			// sheen (light reflection sweeping the other way)
			const sh = ctx!.createConicGradient(sheen, 0, 0);
			sh.addColorStop(0, 'rgba(255,255,255,0)');
			sh.addColorStop(0.08, 'rgba(120,200,150,0.10)');
			sh.addColorStop(0.16, 'rgba(255,255,255,0)');
			sh.addColorStop(0.5, 'rgba(255,255,255,0)');
			sh.addColorStop(0.58, 'rgba(200,169,110,0.08)');
			sh.addColorStop(0.66, 'rgba(255,255,255,0)');
			sh.addColorStop(1, 'rgba(255,255,255,0)');
			ctx!.fillStyle = sh;
			ctx!.beginPath();
			ctx!.arc(0, 0, R * 0.96, 0, Math.PI * 2);
			ctx!.fill();
			// label
			ctx!.beginPath();
			ctx!.arc(0, 0, R * 0.34, 0, Math.PI * 2);
			ctx!.closePath();
			if (label && label.complete && label.naturalWidth) {
				ctx!.save();
				ctx!.clip();
				ctx!.drawImage(label, -R * 0.34, -R * 0.34, R * 0.68, R * 0.68);
				ctx!.restore();
			} else {
				ctx!.fillStyle = '#4a9e6b';
				ctx!.fill();
				ctx!.fillStyle = 'rgba(10,15,11,0.85)';
				ctx!.font = `italic ${R * 0.09}px "Playfair Display", serif`;
				ctx!.textAlign = 'center';
				ctx!.textBaseline = 'middle';
				ctx!.fillText('soundtrackd', 0, -R * 0.06);
				ctx!.font = `${R * 0.05}px Nunito, sans-serif`;
				ctx!.fillText('33⅓ RPM · SIDE A', 0, R * 0.08);
			}
			ctx!.strokeStyle = 'rgba(0,0,0,0.5)';
			ctx!.lineWidth = 2;
			ctx!.beginPath();
			ctx!.arc(0, 0, R * 0.34, 0, Math.PI * 2);
			ctx!.stroke();
			// spindle hole
			ctx!.fillStyle = '#0a0f0b';
			ctx!.beginPath();
			ctx!.arc(0, 0, R * 0.02, 0, Math.PI * 2);
			ctx!.fill();
			ctx!.restore();

			// tonearm: pivot top-right, stylus lands at radius between outer and inner groove
			const px = size * 0.92;
			const py = size * 0.08;
			const rad = R * (0.9 - t * 0.5);
			// stylus point on the disc at angle ~ -35deg from the pivot
			const ang = Math.PI * 0.78 + t * 0.12;
			const sx = cx + Math.cos(ang) * rad;
			const sy = cy - Math.sin(ang) * rad + size * 0.05;
			ctx!.save();
			ctx!.shadowColor = 'rgba(0,0,0,0.5)';
			ctx!.shadowBlur = 12;
			ctx!.shadowOffsetY = 8;
			ctx!.lineCap = 'round';
			ctx!.strokeStyle = '#b8bcb9';
			ctx!.lineWidth = 6;
			ctx!.beginPath();
			ctx!.moveTo(px, py);
			ctx!.lineTo(sx, sy);
			ctx!.stroke();
			ctx!.strokeStyle = '#e2e8e3';
			ctx!.lineWidth = 2;
			ctx!.beginPath();
			ctx!.moveTo(px, py);
			ctx!.lineTo(sx, sy);
			ctx!.stroke();
			// pivot base
			ctx!.fillStyle = '#2a2f2b';
			ctx!.beginPath();
			ctx!.arc(px, py, 16, 0, Math.PI * 2);
			ctx!.fill();
			ctx!.fillStyle = '#4a9e6b';
			ctx!.beginPath();
			ctx!.arc(px, py, 5, 0, Math.PI * 2);
			ctx!.fill();
			// headshell + cartridge
			ctx!.fillStyle = '#c8a96e';
			ctx!.beginPath();
			ctx!.arc(sx, sy, 7, 0, Math.PI * 2);
			ctx!.fill();
			ctx!.restore();
		}

		function frame(now: number) {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (visible && !hidden) {
				angle += dt * Math.PI * 2 * (33.333 / 60); // 33⅓ rpm
				sheen -= dt * 0.35;
				draw(angle, arm);
			}
			raf = requestAnimationFrame(frame);
		}

		const onScroll = () => {
			const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
			arm = Math.min(1, window.scrollY / max);
			if (!animate) draw(angle, arm);
		};
		const io = new IntersectionObserver((entries) => (visible = entries[0]?.isIntersecting ?? true), { threshold: 0.05 });
		io.observe(el);
		const onVis = () => (hidden = document.hidden);
		document.addEventListener('visibilitychange', onVis);
		window.addEventListener('scroll', onScroll, { passive: true });

		draw(0, 0);
		ready = true;
		if (animate) raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
			window.removeEventListener('scroll', onScroll);
		};
	});
</script>

<div class="turntable" style="--size:{size}px" aria-hidden="true">
	<div class="poster" class:hidden={ready}></div>
	<canvas bind:this={canvas} class="disc" class:ready style="width:{size}px;height:{size}px"></canvas>
</div>

<style>
	.turntable {
		position: relative;
		width: var(--size);
		height: var(--size);
		transform: perspective(1100px) rotateX(48deg) rotateZ(-10deg);
		transform-style: preserve-3d;
		filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.5));
	}
	.poster,
	.disc {
		position: absolute;
		inset: 0;
	}
	.poster {
		border-radius: 50%;
		background:
			radial-gradient(circle, #4a9e6b 0 17%, #0a0f0b 17.5% 18.5%, #151515 19% 100%),
			#111;
		transform: scale(0.96);
		transition: opacity 0.4s;
	}
	.poster.hidden {
		opacity: 0;
	}
	.disc {
		opacity: 0;
		transition: opacity 0.4s;
	}
	.disc.ready {
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.turntable {
			transform: perspective(1100px) rotateX(48deg) rotateZ(-10deg);
		}
	}
</style>
