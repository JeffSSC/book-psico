<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookFace } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import FaceView from './FaceView.svelte';
	import PageLeaf from './PageLeaf.svelte';
	import { PAGE_HEIGHT, PAGE_WIDTH, SPREAD_HEIGHT, SPREAD_WIDTH } from './pageScale';
	import { prefersReducedMotion } from './reducedMotion';

	/**
	 * The book as two sides. A side may be empty: the closed book is the
	 * cover alone on the right, the finished book the back cover alone on
	 * the left.
	 *
	 * The store commits a spread change only when the leaf lands, so
	 * during a turn `spreadIndex` is the spread being left and
	 * `pending` is the one being opened. The leaf bridges the leaving
	 * spread's right side to the incoming spread's left side; beneath
	 * it we always show the leaving left side (read) and the incoming
	 * right side (unread).
	 */

	let {
		sides,
		scale,
		sizes,
		onFlipEnd
	}: {
		/** The sides of the book in order; `null` is an empty side. */
		sides: (BookFace | null)[];
		/** Uniform scale computed by the scene (fitScale helpers). */
		scale: number;
		/** `sizes` of one page image, shared with the scene's preloads. */
		sizes: string;
		/** Commit the pending position when the leaf lands. */
		onFlipEnd: () => void;
	} = $props();

	let reduced = $state(false);
	onMount(() => {
		reduced = prefersReducedMotion();
	});

	const current = $derived(bookStore.spreadIndex);
	const pending = $derived(bookStore.pending);
	const direction = $derived(bookStore.flipDirection);
	const isFlipping = $derived(bookStore.isFlipping);

	const from = $derived(current);
	const to = $derived(isFlipping ? (pending?.spreadIndex ?? current) : current);

	const leftIdx = $derived(
		isFlipping && !reduced ? (direction === 'next' ? from * 2 : to * 2) : to * 2
	);
	/**
	 * A forward turn lifts the leaf off the right side, exposing
	 * the incoming one underneath — so the target shows at once.
	 * A backward turn is the opposite: the leaf swings across the
	 * right side and lands on it, so that side must keep the one
	 * we are leaving until the leaf has covered it.
	 */
	const rightIdx = $derived(
		isFlipping && !reduced && direction === 'prev' ? from * 2 + 1 : to * 2 + 1
	);

	const left = $derived(sides[leftIdx] ?? null);
	const right = $derived(sides[rightIdx] ?? null);
	const leafFront = $derived(sides[direction === 'next' ? from * 2 + 1 : from * 2] ?? null);
	const leafBack = $derived(sides[direction === 'next' ? to * 2 : to * 2 + 1] ?? null);

	// Reduced motion swaps the leaf for an instant swap of sides, so
	// the position commits on the next frame instead of the animation end.
	$effect(() => {
		if (isFlipping && reduced) {
			const frame = requestAnimationFrame(() => onFlipEnd());
			return () => cancelAnimationFrame(frame);
		}
	});
</script>

<div
	class="spread-frame"
	style:width={`${SPREAD_WIDTH * scale}px`}
	style:height={`${SPREAD_HEIGHT * scale}px`}
	style:--page-w={`${PAGE_WIDTH}px`}
	style:--page-h={`${PAGE_HEIGHT}px`}
>
	<div
		class="spread"
		class:spread--open={left && right}
		class:flip-next={isFlipping && direction === 'next'}
		class:flip-prev={isFlipping && direction === 'prev'}
		style:transform={`scale(${scale})`}
	>
		<!-- Read side -->
		<div class="half half--left" class:half--filled={left}>
			{#if left}
				<FaceView face={left} side="left" {sizes} />
			{/if}
			<div class="landing landing--left" aria-hidden="true"></div>
		</div>

		{#if left && right}
			<div class="gutter" aria-hidden="true"></div>
		{/if}

		<!-- Unread side -->
		<div class="half half--right" class:half--filled={right}>
			{#if right}
				<FaceView face={right} side="right" {sizes} />
			{/if}
			<div class="landing landing--right" aria-hidden="true"></div>
		</div>

		<!-- The turning leaf (mounted for the duration of the turn) -->
		{#if isFlipping && !reduced && leafFront}
			<div
				class="half half--leaf"
				class:half--left={direction === 'prev'}
				class:half--right={direction === 'next'}
			>
				<PageLeaf
					frontPage={leafFront}
					backPage={leafBack}
					frontSide={direction === 'next' ? 'right' : 'left'}
					backSide={direction === 'next' ? 'left' : 'right'}
					{direction}
					{sizes}
					onEnd={onFlipEnd}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.spread-frame {
		position: relative;
		flex: none;
	}

	.spread {
		position: relative;
		width: calc(var(--page-w) * 2);
		height: var(--page-h);
		perspective: 1700px;
		/* Fitted to the frame by the scene's scale. */
		transform-origin: top left;
	}

	.half {
		position: absolute;
		top: 0;
		width: var(--page-w);
		height: var(--page-h);
		/* Keep the leaf's 3D in the spread's perspective
		   context — a flat wrapper would squash the
		   swing into a flat horizontal shrink. */
		transform-style: preserve-3d;
	}
	.half--left {
		left: 0;
	}
	/* Each side that holds a face casts the book's shadow; the leaf does not. */
	.half--filled:not(.half--leaf) {
		box-shadow:
			0 2px 4px rgba(74, 48, 16, 0.3),
			0 18px 40px rgba(74, 48, 16, 0.35);
	}
	/* With both sides filled, neither shadow may fall across the spine. */
	.spread--open .half--left.half--filled:not(.half--leaf) {
		clip-path: inset(-80px 0 -80px -80px);
	}
	.spread--open .half--right.half--filled:not(.half--leaf) {
		clip-path: inset(-80px -80px -80px 0);
	}
	.half--right {
		right: 0;
	}

	.gutter {
		position: absolute;
		top: 0;
		left: 50%;
		width: 10px;
		height: var(--page-h);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 15;
		opacity: 0.6;
		/* The crease itself: a thin dark line where the two pages meet. */
		background: linear-gradient(to right, transparent, rgba(16, 9, 2, 0.75) 50%, transparent);
	}

	/* Landing shadow on the side receiving the leaf. */
	.landing {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 10;
		opacity: 0;
	}
	.landing--left {
		background: linear-gradient(to left, rgba(4, 6, 16, 0.55), transparent 58%);
	}
	.landing--right {
		background: linear-gradient(to right, rgba(4, 6, 16, 0.55), transparent 58%);
	}

	.spread.flip-next .landing--left,
	.spread.flip-prev .landing--right {
		animation: landing-in 700ms ease both;
	}
	.spread.flip-next .gutter,
	.spread.flip-prev .gutter {
		animation: gutter-swell 700ms ease both;
	}

	@keyframes landing-in {
		0% {
			opacity: 0;
		}
		55% {
			opacity: 0;
		}
		100% {
			opacity: 0.55;
		}
	}
	@keyframes gutter-swell {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.6;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spread.flip-next .landing--left,
		.spread.flip-prev .landing--right,
		.spread.flip-next .gutter,
		.spread.flip-prev .gutter {
			animation: none;
		}
	}
</style>
