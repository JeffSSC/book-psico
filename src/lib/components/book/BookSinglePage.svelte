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
	 * The track is the whole book laid out side by side and is NEVER
	 * recomposed: navigating only moves the window (one transform on
	 * one element). That makes the motion always a clean single slide
	 * in one direction — the track value changes when navigation
	 * starts and stays put when the position commits, so there is no
	 * ghost re-slide and a transition can never be interrupted into
	 * a value-equal no-op (which would swallow the transitionend and
	 * freeze the navigation).
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

	/** The page that should sit in the window. */
	const restingIdx = $derived(targetIdx);

	/**
	 * A far jump (table of contents) would sweep the whole book
	 * across the screen, so it cuts straight to the page —
	 * see AD/UI/2D-UI.md §15.
	 */
	const isFarJump = $derived(isFlipping && Math.abs(targetIdx - currentIdx) > 1);

	/**
	 * Window position over the static track. It depends on
	 * `restingIdx` only, so it changes when a move STARTS and does
	 * not change again when the move commits (currentIdx becomes
	 * targetIdx). That keeps the DOM static throughout the move.
	 */
	const trackX = $derived(-restingIdx * PAGE_WIDTH);

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
				style:width={`${pages.length * PAGE_WIDTH}px`}
				style:transform={`translateX(${trackX}px)`}
				ontransitionend={(event) => {
					if (event.target === event.currentTarget && event.propertyName === 'transform') {
						onTransitionEnd();
					}
				}}
			>
				{#each pages as entry, index (entry.id)}
					<!-- Only the page in the window is on screen; the others stay
						mounted in the static track but are hidden from assistive
						tech and removed from the tab order. -->
					<div
						class="track-slot"
						class:track-slot--offscreen={index !== restingIdx}
						aria-hidden={index !== restingIdx}
						inert={index !== restingIdx}
					>
						<PageView page={entry} side={sideOf(index)} showNumber={entry.pageNumber !== 1} />
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
