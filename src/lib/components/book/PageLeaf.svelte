<script lang="ts">
	import type { BookPage, FlipDirection, PageSide } from '../../types/book';
	import PageView from './PageView.svelte';

	/**
	 * The turning leaf. It fills its positioning parent (a spread half, or the
	 * whole page in single mode) and hinges on the spine:
	 *
	 * - "next" leaves hinge on their LEFT edge and rotate 0 -> -180deg,
	 * - "prev" leaves hinge on their RIGHT edge and rotate 0 -> +180deg,
	 *
	 * so the free edge always lifts toward the viewer (out of the table) and
	 * the leaf sweeps to the other side of the spine. Face shading is baked
	 * per direction: the departing face deepens as it turns away, the
	 * arriving face lands in the light.
	 */

	let {
		frontPage,
		backPage,
		frontSide = 'right',
		backSide = 'left',
		direction,
		onEnd
	}: {
		/** The face currently on top (the page being turned away from). */
		frontPage: BookPage;
		/** The face revealed underneath / that lands after the turn. */
		backPage: BookPage;
		frontSide?: PageSide;
		backSide?: PageSide;
		direction: FlipDirection;
		/** Fires when the turn animation finishes (commit the position). */
		onEnd: () => void;
	} = $props();

	function handleAnimationEnd(event: AnimationEvent) {
		// Pseudo-element (shade) animations also report to their host face;
		// only the leaf's own rotation completes the turn.
		if (event.target === event.currentTarget) onEnd();
	}
</script>

<div
	class="leaf"
	class:leaf-next={direction === 'next'}
	class:leaf-prev={direction === 'prev'}
	onanimationend={handleAnimationEnd}
>
	<div class="face face--front">
		<PageView page={frontPage} side={frontSide} showNumber={frontPage.pageNumber !== 1} />
	</div>
	<div class="face face--back">
		<PageView page={backPage} side={backSide} showNumber={backPage.pageNumber !== 1} />
	</div>
</div>

<style>
	.leaf {
		position: absolute;
		inset: 0;
		z-index: 20;
		transform-style: preserve-3d;
	}

	.leaf {
		--leaf-dur: 700ms;
		/* Symmetric on purpose: at 50% of the animation the leaf is
		   exactly edge-on (90°), which is where the two faces swap. */
		--leaf-ease: cubic-bezier(0.45, 0, 0.55, 1);
	}

	.leaf-next {
		transform-origin: left center;
		animation: leaf-next var(--leaf-dur) var(--leaf-ease) both;
	}
	.leaf-prev {
		transform-origin: right center;
		animation: leaf-prev var(--leaf-dur) var(--leaf-ease) both;
	}

	@keyframes leaf-next {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(-180deg);
		}
	}
	@keyframes leaf-prev {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(180deg);
		}
	}

	/**
	 * The two faces are swapped by visibility, not by `backface-visibility`.
	 * Chromium decides an element's facing from its own transform only, so
	 * the face carrying the 180° pre-rotation gets culled even while it is
	 * the one turned toward you — and the face with no pre-rotation is never
	 * culled, so you get the outgoing page mirrored on the back. Swapping
	 * explicitly at the edge-on moment (50%, thanks to the symmetric easing)
	 * is exact at every angle and every browser.
	 */
	.face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #fdfbf7;
		/* The leaf is decorative while turning; taps belong to the page
		   underneath (and input is locked mid-flip anyway). */
		pointer-events: none;
	}
	.face--front {
		animation: face-front var(--leaf-dur) var(--leaf-ease) both;
	}
	.face--back {
		visibility: hidden;
		transform: rotateY(180deg);
		animation: face-back var(--leaf-dur) var(--leaf-ease) both;
	}

	@keyframes face-front {
		0%,
		49.99% {
			visibility: visible;
		}
		50%,
		100% {
			visibility: hidden;
		}
	}
	@keyframes face-back {
		0%,
		49.99% {
			visibility: hidden;
		}
		50%,
		100% {
			visibility: visible;
		}
	}

	/* Shading near the spine side of each face. */
	.face::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 30;
	}
	.leaf-next .face--front::after {
		background: linear-gradient(to right, rgba(30, 24, 12, 0.55), transparent 52%);
	}
	.leaf-next .face--back::after,
	.leaf-prev .face--front::after {
		background: linear-gradient(to left, rgba(30, 24, 12, 0.55), transparent 52%);
	}
	.leaf-prev .face--back::after {
		background: linear-gradient(to right, rgba(30, 24, 12, 0.55), transparent 52%);
	}

	.leaf-next .face--front::after,
	.leaf-prev .face--front::after {
		animation: shade-deepen 700ms ease both;
	}
	.leaf-next .face--back::after,
	.leaf-prev .face--back::after {
		animation: shade-soften 700ms ease both;
	}

	@keyframes shade-deepen {
		from {
			opacity: 0.14;
		}
		to {
			opacity: 0.5;
		}
	}
	@keyframes shade-soften {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 0.18;
		}
	}
</style>
