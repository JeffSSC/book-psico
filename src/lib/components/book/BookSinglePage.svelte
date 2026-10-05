<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookPage, PageSide } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import PageView from './PageView.svelte';
	import { PAGE_HEIGHT, PAGE_WIDTH } from './pageScale';
	import { prefersReducedMotion } from './reducedMotion';

	/**
	 * The mobile view: one page at a time, and every step is a slide.
	 *
	 * The track holds the current page plus one neighbour on each side,
	 * so moving forward or back is a translation of the same mounted
	 * element — no leaf anywhere. Because the neighbours are the real
	 * facing pages, crossing a spread boundary is just the next page
	 * sliding in, and the two pages meet at the gutter exactly as they
	 * do in the book.
	 */

	let {
		pages,
		scale,
		onTransitionEnd
	}: {
		pages: BookPage[];
		/** Uniform scale computed by the scene (fitScale helpers). */
		scale: number;
		/** Commit the pending position when the slide finishes. */
		onTransitionEnd: () => void;
	} = $props();

	let reduced = $state(false);
	onMount(() => {
		reduced = prefersReducedMotion();
	});

	const current = $derived(bookStore.spreadIndex);
	const side = $derived(bookStore.side);
	const pending = $derived(bookStore.pending);
	const isFlipping = $derived(bookStore.isFlipping);

	const currentIdx = $derived(current * 2 + (side === 'right' ? 1 : 0));
	const targetIdx = $derived(
		isFlipping && pending
			? pending.spreadIndex * 2 + (pending.side === 'right' ? 1 : 0)
			: currentIdx
	);

	/** Page on screen right now: the target while a move is running. */
	const restingIdx = $derived(targetIdx);

	/**
	 * A far jump (the index) cannot be shown by sliding a three-page
	 * track without rendering the whole book at once, so it cuts
	 * straight to the page — see AD/UI/2D-UI.md §15.
	 */
	const isFarJump = $derived(isFlipping && Math.abs(targetIdx - currentIdx) > 1);

	/** The track is composed from the committed page, so it never shifts mid-slide.
	 * During a transition, keep the strip fixed to avoid DOM reordering mid-animation.
	 */
	const baseIdx = $derived(isFlipping ? currentIdx : currentIdx);
	const first = $derived(Math.max(0, currentIdx - 1));
	const last = $derived(Math.min(pages.length - 1, currentIdx + 1));
	const track = $derived(pages.slice(first, last + 1));
	const trackFirst = $derived(first);
	const trackX = $derived(-(restingIdx - trackFirst) * PAGE_WIDTH);

	// Keep track composition stable during transition to avoid DOM reordering
	// Strip is always computed from currentIdx, never from targetIdx
	// This prevents mid-animation jumps
	const stableFirst = $derived(isFlipping ? currentIdx - 1 : currentIdx - 1);
	const stableLast = $derived(isFlipping ? currentIdx + 1 : currentIdx + 1);
	const stableTrack = $derived(
		pages.slice(Math.max(0, stableFirst), Math.min(pages.length - 1, stableLast) + 1)
	);
	const stableTrackFirst = $derived(
		isFlipping ? Math.max(0, currentIdx - 1) : Math.max(0, currentIdx - 1)
	);

	// The visible index is targetIdx during flip, currentIdx at rest
	const visibleIdx = $derived(isFlipping ? targetIdx : currentIdx);
	const trackXStable = $derived(-(visibleIdx - stableTrackFirst) * PAGE_WIDTH);

	const page = (i: number): BookPage => pages[i] ?? pages[0];
	const sideOf = (i: number): PageSide => (i % 2 === 0 ? 'left' : 'right');

	// Reduced motion and far jumps have nothing to animate, so the
	// position is committed on the next frame instead of on a
	// transition end (CSS transitions are off for the former).
	$effect(() => {
		if (isFlipping && (reduced || isFarJump)) {
			const frame = requestAnimationFrame(() => onTransitionEnd());
			return () => cancelAnimationFrame(frame);
		}
	});
</script>

<div
	class="single-frame"
	style:width={`${PAGE_WIDTH * scale}px`}
	style:height={`${PAGE_HEIGHT * scale}px`}
>
	<div class="single" style:transform={`scale(${scale})`}>
		{#if isFarJump}
			<PageView page={page(targetIdx)} side={sideOf(targetIdx)} showNumber={targetIdx !== 0} />
		{:else}
			<div
				class="slide-track"
				style:width={`${stableTrack.length * PAGE_WIDTH}px`}
				style:transform={`translateX(${trackXStable}px)`}
				ontransitionend={(event) => {
					if (event.target === event.currentTarget && event.propertyName === 'transform') {
						onTransitionEnd();
					}
				}}
			>
				{#each stableTrack as entry, slot (entry.id)}
					<!-- Only the page in the viewport is on-screen; the neighbours stay
						mounted so the slide can run, but they are hidden from assistive tech. -->
					<div
						class="track-slot"
						class:track-slot--offscreen={stableTrackFirst + slot !== restingIdx}
						aria-hidden={stableTrackFirst + slot !== restingIdx}
					>
						<PageView
							page={entry}
							side={sideOf(stableTrackFirst + slot)}
							showNumber={entry.pageNumber !== 1}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.single-frame {
		position: relative;
		flex: none;
	}

	.single {
		position: relative;
		width: 512px;
		height: 720px;
		overflow: hidden;
		/* Fitted to the frame by the scene's scale. */
		transform-origin: top left;
	}

	.slide-track {
		display: flex;
		height: 720px;
		transition: transform 340ms cubic-bezier(0.3, 0, 0.2, 1);
		will-change: transform;
	}

	.track-slot {
		display: contents;
	}

	@media (prefers-reduced-motion: reduce) {
		.slide-track {
			transition: none;
		}
	}
</style>
