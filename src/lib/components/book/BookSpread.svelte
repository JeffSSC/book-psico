<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookPage } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import PageView from './PageView.svelte';
	import PageLeaf from './PageLeaf.svelte';
	import { SPREAD_HEIGHT, SPREAD_WIDTH } from './pageScale';
	import { prefersReducedMotion } from './reducedMotion';

	/**
	 * The open book, top down: a two-page spread.
	 *
	 * The store commits a spread change only when the leaf lands, so
	 * during a turn `spreadIndex` is the spread being left and
	 * `pending` is the one being opened. The leaf bridges the leaving
	 * spread's right page to the incoming spread's left page; beneath
	 * it we always show the leaving left page (read side) and the
	 * incoming right page (unread side).
	 */

	let {
		pages,
		scale,
		splay = false,
		onFlipEnd
	}: {
		pages: BookPage[];
		/** Uniform scale computed by the scene (fitScale helpers). */
		scale: number;
		/** True while the book is opening: page 01 splays left
		 *  about the gutter onto the face-down cover. */
		splay?: boolean;
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

	const leftPageIdx = $derived(
		isFlipping && !reduced ? (direction === 'next' ? from * 2 : to * 2) : to * 2
	);
	/**
	 * A forward turn lifts the leaf off the right page, exposing
	 * the incoming one underneath — so the target shows at once.
	 * A backward turn is the opposite: the leaf swings across the
	 * right page and lands on it, so that page must keep the one
	 * we are leaving until the leaf has covered it.
	 */
	const rightPageIdx = $derived(
		isFlipping && !reduced && direction === 'prev' ? from * 2 + 1 : to * 2 + 1
	);

	const leafFrontIdx = $derived(direction === 'next' ? from * 2 + 1 : from * 2);
	const leafBackIdx = $derived(direction === 'next' ? to * 2 : to * 2 + 1);

	const leftHasStack = $derived(from > 0);
	const rightHasStack = $derived(to < Math.ceil(pages.length / 2) - 1);

	const page = (i: number): BookPage => pages[i] ?? pages[0];

	// Reduced motion swaps the leaf for an instant swap of pages, so
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
>
	<div
		class="spread"
		class:flip-next={isFlipping && direction === 'next'}
		class:flip-prev={isFlipping && direction === 'prev'}
		style:transform={`scale(${scale})`}
	>
		<!-- Read side: during the opening, page 01 splays left about the
		     gutter and lands on the face-down cover (see §5). -->
		<div class="half half--left" class:splaying={splay}>
			<div class="splay-face">
				{#if leftHasStack}
					<div class="stack stack--left" aria-hidden="true"></div>
				{/if}
				<PageView page={page(leftPageIdx)} side="left" showNumber={leftPageIdx !== 0} />
			</div>
			<div class="landing landing--left" aria-hidden="true"></div>
		</div>

		<div class="gutter" aria-hidden="true"></div>

		<!-- Unread side -->
		<div class="half half--right">
			{#if rightHasStack}
				<div class="stack stack--right" aria-hidden="true"></div>
			{/if}
			<PageView page={page(rightPageIdx)} side="right" showNumber={true} />
			<div class="landing landing--right" aria-hidden="true"></div>
		</div>

		<!-- The turning leaf (mounted for the duration of the turn) -->
		{#if isFlipping && !reduced}
			<div
				class="half"
				class:half--left={direction === 'prev'}
				class:half--right={direction === 'next'}
			>
				<PageLeaf
					frontPage={page(leafFrontIdx)}
					backPage={page(leafBackIdx)}
					frontSide={direction === 'next' ? 'right' : 'left'}
					backSide={direction === 'next' ? 'left' : 'right'}
					{direction}
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
		width: 1032px;
		height: 720px;
		perspective: 1700px;
		/* Fitted to the frame by the scene's scale. */
		transform-origin: top left;
	}

	.half {
		position: absolute;
		top: 0;
		width: 512px;
		height: 720px;
		/* Keep the leaf's 3D in the spread's perspective
		   context — a flat wrapper would squash the
		   swing into a flat horizontal shrink. */
		transform-style: preserve-3d;
	}
	.half--left {
		left: 0;
	}
	.half--right {
		right: 0;
	}

	/* The read/unread piles under the top pages. */
	.stack {
		position: absolute;
		inset: 2px 3px -3px 2px;
		border-radius: 2px;
		background: repeating-linear-gradient(to bottom, #f4efe3 0 2px, #ddd5c4 2px 3px), #f4efe3;
		box-shadow: 0 1px 2px rgba(64, 52, 34, 0.35);
	}
	.stack--right {
		inset: 2px 2px -3px 3px;
	}

	.gutter {
		position: absolute;
		top: 0;
		left: 50%;
		width: 44px;
		height: 720px;
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 15;
		opacity: 0.4;
		background: linear-gradient(to right, transparent, rgba(50, 40, 24, 0.5) 50%, transparent);
	}

	/* Landing shadow on the side receiving the leaf. */
	/* Flat wrapper (no preserve-3d) so backface-visibility can hide
	   the mirrored page while it is face-down mid-splay. */
	.splay-face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
	}

	@media (prefers-reduced-motion: no-preference) {
		.half--left.splaying .splay-face {
			transform-origin: right center;
			animation: splay-in 320ms cubic-bezier(0.4, 0, 0.2, 1) 330ms both;
		}
	}

	@keyframes splay-in {
		from {
			transform: rotateY(180deg);
		}
		to {
			transform: rotateY(0deg);
		}
	}

	.landing {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 10;
		opacity: 0;
	}
	.landing--left {
		background: linear-gradient(to left, rgba(30, 24, 12, 0.5), transparent 58%);
	}
	.landing--right {
		background: linear-gradient(to right, rgba(30, 24, 12, 0.5), transparent 58%);
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
			opacity: 0.4;
		}
		50% {
			opacity: 0.85;
		}
		100% {
			opacity: 0.45;
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
