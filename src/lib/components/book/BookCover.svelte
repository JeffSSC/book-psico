<script lang="ts">
	import { bookMeta } from '../../data/bookMeta';
	import { bookUiCopy } from '../../data/uiCopy';
	import { bookStore } from '../../stores/bookStore.svelte';

	/**
	 * The closed book, top down: the front cover art plus a thick, soft shadow
	 * that sells physicality. Pointer devices get a small parallax tilt so the
	 * cover can be admired before opening (touch stays still).
	 *
	 * The art mirrors the old procedural texture: dark slate linen, gold foil
	 * double frame with corner accents, the spotlight/eye motif, and the foil
	 * lettering — all as scalable DOM/SVG instead of a baked bitmap.
	 */

	let root = $state<HTMLElement | null>(null);

	function open() {
		if (bookStore.bookUIState === 'closed') bookStore.openBook();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!root || event.pointerType !== 'mouse') return;
		const rect = root.getBoundingClientRect();
		const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
		root.style.setProperty('--tilt-x', `${(ny * -3.5).toFixed(2)}deg`);
		root.style.setProperty('--tilt-y', `${(nx * 4.5).toFixed(2)}deg`);
	}

	function handlePointerLeave() {
		root?.style.setProperty('--tilt-x', '0deg');
		root?.style.setProperty('--tilt-y', '0deg');
	}

	const corners = [
		{ className: 'dot--tl' },
		{ className: 'dot--tr' },
		{ className: 'dot--bl' },
		{ className: 'dot--br' }
	];
</script>

<button
	bind:this={root}
	type="button"
	class="cover-root group relative block cursor-pointer border-0 bg-transparent p-0 focus:outline-none"
	aria-label={bookUiCopy.experience.clickToOpenLabel}
	onclick={open}
	onpointermove={handlePointerMove}
	onpointerleave={handlePointerLeave}
>
	<div class="cover">
		<!-- Page block peeking past the cover: the same cream
		     page edge the open book shows on its stacks, so
		     the closed cover reads as the same physical book. -->
		<div class="edges" aria-hidden="true">
			<span class="edge edge--right"></span>
			<span class="edge edge--bottom"></span>
		</div>

		<!-- Slate linen base + grain -->
		<div class="cover-base" aria-hidden="true"></div>
		<div class="cover-grain" aria-hidden="true"></div>

		<!-- Gold foil frame -->
		<div class="frame frame--outer" aria-hidden="true"></div>
		<div class="frame frame--inner" aria-hidden="true"></div>
		{#each corners as corner (corner.className)}
			<span class="dot {corner.className}" aria-hidden="true"></span>
		{/each}

		<!-- Spotlight / eye motif. The halo and ring are SVG strokes, not
		     dashed CSS borders: a dashed border on a 50% border-radius
		     rasterizes through a border path that breaks apart under the
		     cover's 3D tilt (dashes drop out and smear). -->
		<div class="motif" aria-hidden="true">
			<svg class="rings" viewBox="0 0 130 130" fill="none">
				<circle
					cx="65"
					cy="65"
					r="64.25"
					stroke="rgba(212, 175, 55, 0.35)"
					stroke-width="1.5"
					stroke-dasharray="4.5 4.5"
				/>
				<circle cx="65" cy="65" r="54" stroke="#D4AF37" stroke-width="2" />
			</svg>
			<svg class="eye" viewBox="0 0 130 130" fill="none">
				<path
					d="M28 65 Q65 42.5 102 65 Q65 87.5 28 65 Z"
					stroke="#F3E5AB"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<circle cx="65" cy="65" r="11" fill="#D4AF37" />
				<circle cx="65" cy="65" r="5" fill="#16191F" />
				<circle cx="62.5" cy="62.5" r="1.8" fill="#FFFFFF" />
			</svg>
		</div>
		<p class="badge">{bookMeta.cover.badge}</p>

		<!-- Foil lettering -->
		<h1 class="title">
			{#each bookMeta.cover.titleLines as line (line)}
				<span class="title-line">{line}</span>
			{/each}
		</h1>

		<div class="divider" aria-hidden="true"><span class="diamond"></span></div>

		<p class="subtitle">
			{#each bookMeta.cover.subtitleLines as line (line)}
				<span>{line}</span>
			{/each}
		</p>

		<p class="credits">{bookMeta.cover.credits}</p>
		<p class="edition">{bookMeta.cover.edition}</p>

		<!-- Hover sheen: the cover catches the light as it tilts -->
		<div class="sheen" aria-hidden="true"></div>
	</div>
</button>

<style>
	.cover-root {
		width: 512px;
		height: 720px;
	}

	.cover {
		position: relative;
		width: 512px;
		height: 720px;
		/* No clipping: the page edges extend past the cover
		   box (the inset layers below carry the radius). */
		border-radius: 3px;
		/* Book on a desk: stacked, soft shadows. */
		box-shadow:
			0 1px 2px rgba(20, 16, 10, 0.35),
			0 10px 28px rgba(20, 16, 10, 0.38),
			0 30px 70px rgba(20, 16, 10, 0.3);
		/* Hover tilt (BookScene disables the whole scene under reduced motion). */
		transform: perspective(1200px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
		transition: transform 0.16s ease-out;
		will-change: transform;
	}

	/* Page-edge slivers: the cream block inside the cover. */
	.edges {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.edge {
		position: absolute;
		background: repeating-linear-gradient(to bottom, #f4efe3 0 2px, #ddd5c4 2px 3px), #f4efe3;
	}
	.edge--right {
		top: 4px;
		bottom: -4px;
		right: -7px;
		width: 7px;
		border-radius: 0 2px 2px 0;
		box-shadow: 2px 2px 5px rgba(40, 32, 20, 0.3);
	}
	.edge--bottom {
		top: 4px;
		left: 4px;
		right: -4px;
		bottom: -7px;
		height: 7px;
		border-radius: 0 0 2px 2px;
		background: repeating-linear-gradient(to right, #f4efe3 0 2px, #ddd5c4 2px 3px), #f4efe3;
		box-shadow: 2px 2px 5px rgba(40, 32, 20, 0.3);
	}

	.cover-base {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		background: linear-gradient(165deg, #1e2229 0%, #16191f 50%, #0f1216 100%);
	}

	.cover-grain {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		opacity: 0.6;
		background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='140'%20height='140'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.9'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='140'%20height='140'%20filter='url(%23n)'%20opacity='0.05'/%3E%3C/svg%3E");
	}

	/* Subtle vertical sheen that shifts with the tilt. */
	.sheen {
		position: absolute;
		inset: 0;
		border-radius: 3px;
		pointer-events: none;
		background: linear-gradient(
			115deg,
			transparent 30%,
			rgba(255, 244, 214, 0.05) 48%,
			transparent 62%
		);
	}

	.frame {
		position: absolute;
		pointer-events: none;
	}
	.frame--outer {
		inset: 24px;
		border: 2px solid rgba(212, 175, 55, 0.95);
	}
	.frame--inner {
		inset: 31px;
		border: 1px solid rgba(212, 175, 55, 0.5);
	}

	.dot {
		position: absolute;
		width: 5px;
		height: 5px;
		border-radius: 9999px;
		background: #d4af37;
	}
	.dot--tl {
		top: 22px;
		left: 22px;
	}
	.dot--tr {
		top: 22px;
		right: 22px;
	}
	.dot--bl {
		bottom: 22px;
		left: 22px;
	}
	.dot--br {
		bottom: 22px;
		right: 22px;
	}

	.motif {
		position: absolute;
		left: 50%;
		top: 250px;
		width: 130px;
		height: 130px;
		transform: translate(-50%, -50%);
	}
	.rings {
		position: absolute;
		inset: 0;
	}
	.eye {
		position: absolute;
		inset: 26px;
	}

	.badge {
		position: absolute;
		top: 316px;
		width: 100%;
		text-align: center;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.32em;
		color: rgba(212, 175, 55, 0.85);
	}

	.title {
		position: absolute;
		top: 376px;
		width: 100%;
		text-align: center;
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: 30px;
		line-height: 1.3;
		letter-spacing: 0.08em;
		color: #fdfbf7;
		text-shadow: 0 3px 8px rgba(0, 0, 0, 0.6);
	}
	.title-line {
		display: block;
	}

	.divider {
		position: absolute;
		top: 466px;
		left: 50%;
		width: 120px;
		height: 1.5px;
		transform: translateX(-50%);
		background: linear-gradient(90deg, transparent, #d4af37 18%, #d4af37 82%, transparent);
	}
	.diamond {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		background: #d4af37;
		transform: translate(-50%, -50%) rotate(45deg);
	}

	.subtitle {
		position: absolute;
		top: 488px;
		width: 380px;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14.5px;
		line-height: 1.6;
		color: rgba(243, 229, 171, 0.9);
	}
	.subtitle span {
		display: block;
	}

	.credits {
		position: absolute;
		top: 620px;
		width: 100%;
		text-align: center;
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: #d4af37;
	}
	.edition {
		position: absolute;
		top: 648px;
		width: 100%;
		text-align: center;
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 400;
		letter-spacing: 0.22em;
		color: rgba(253, 251, 247, 0.5);
	}
</style>
