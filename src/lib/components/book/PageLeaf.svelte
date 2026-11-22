<script lang="ts">
	import type { BookFace, FlipDirection, PageSide } from '../../types/book';
	import FaceView from './FaceView.svelte';

	/**
	 * The turning leaf. It fills its positioning parent (a spread half, or
	 * the single page of a phone) and hinges on the spine:
	 *
	 * - "next" leaves hinge on their LEFT edge and rotate 0 -> -180deg,
	 * - "prev" leaves hinge on their RIGHT edge and rotate 0 -> +180deg,
	 *
	 * so the free edge always lifts toward the viewer (out of the table) and
	 * the leaf sweeps to the other side of the spine. `reverse` plays a turn
	 * backwards: the sheet comes back from the far side and lands.
	 */

	let {
		frontPage,
		backPage,
		frontSide = 'right',
		backSide = 'left',
		direction,
		reverse = false,
		sizes,
		onEnd
	}: {
		/** The face currently on top (the page being turned away from). */
		frontPage: BookFace;
		/** The reverse of the sheet; `null` is blank paper. */
		backPage: BookFace | null;
		frontSide?: PageSide;
		backSide?: PageSide;
		direction: FlipDirection;
		/** Play the turn backwards, ending with the front face lying flat. */
		reverse?: boolean;
		/** On-screen width of a page, for the browser's source choice. */
		sizes: string;
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
	class:leaf-reverse={reverse}
	onanimationend={handleAnimationEnd}
>
	<div class="face face--front">
		<FaceView face={frontPage} side={frontSide} {sizes} />
	</div>
	<div class="face face--back">
		{#if backPage}
			<FaceView face={backPage} side={backSide} {sizes} />
		{/if}
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
	 * The two faces are swapped by opacity, not by `backface-visibility`.
	 * (Opacity, not visibility, so the hidden face is already painted when
	 * its turn comes and never shows blank for a frame.)
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
		/* The leaf is decorative while turning; taps belong to the page
		   underneath (and input is locked mid-flip anyway). */
		pointer-events: none;
	}
	.face--front {
		animation: face-front var(--leaf-dur) var(--leaf-ease) both;
	}
	.face--back {
		/* Blank paper when the sheet has nothing printed on its reverse. */
		background: #f3ead6;
		opacity: 0;
		transform: rotateY(180deg);
		animation: face-back var(--leaf-dur) var(--leaf-ease) both;
	}

	@keyframes face-front {
		0%,
		49.99% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
	}
	@keyframes face-back {
		0%,
		49.99% {
			opacity: 0;
		}
		50%,
		100% {
			opacity: 1;
		}
	}

	.leaf-reverse,
	.leaf-reverse .face,
	.leaf-reverse .face::after {
		animation-direction: reverse;
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
		background: linear-gradient(to right, rgba(6, 8, 20, 0.6), transparent 52%);
	}
	.leaf-next .face--back::after,
	.leaf-prev .face--front::after {
		background: linear-gradient(to left, rgba(6, 8, 20, 0.6), transparent 52%);
	}
	.leaf-prev .face--back::after {
		background: linear-gradient(to right, rgba(6, 8, 20, 0.6), transparent 52%);
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
