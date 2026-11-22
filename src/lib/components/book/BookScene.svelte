<script lang="ts">
	import { onMount } from 'svelte';
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookMeta } from '../../data/bookMeta';
	import { bookSides, pageSources, pagesToPreload } from '../../data/comic';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';
	import type { Comic } from '../../types/book';
	import BookSpread from './BookSpread.svelte';
	import BookSinglePage from './BookSinglePage.svelte';
	import { swipe, type SwipeDirection } from './swipe';
	import {
		PAGE_HEIGHT,
		PAGE_SIZES,
		PAGE_WIDTH,
		SPREAD_HEIGHT,
		SPREAD_WIDTH,
		fitScale,
		viewModeFor
	} from './pageScale';

	/**
	 * Master scene of the HQ: nothing but the book. Owns the framing and the
	 * input (page clicks, swipes, keyboard); the store owns the position.
	 */

	/** Air left between the book and the edge of the screen, per side. */
	const MARGIN = 12;

	let { comic }: { comic: Comic } = $props();

	const sides = $derived(bookSides(comic));

	// Register once so the first paint already knows the shape of the book.
	$effect(() => {
		bookStore.registerPages(sides);
	});

	let viewport = $state<HTMLElement | null>(null);
	/** Room for the book; null until the first measurement. */
	let avail = $state<{ w: number; h: number } | null>(null);

	const mode = $derived(bookStore.mode);

	const bookScale = $derived(
		mode === 'spread'
			? fitScale(SPREAD_WIDTH, SPREAD_HEIGHT, avail?.w ?? 0, avail?.h ?? 0)
			: fitScale(PAGE_WIDTH, PAGE_HEIGHT, avail?.w ?? 0, avail?.h ?? 0)
	);

	/** Size of the book on screen. */
	const bookBoxWidth = $derived((mode === 'spread' ? SPREAD_WIDTH : PAGE_WIDTH) * bookScale);
	const bookBoxHeight = $derived(PAGE_HEIGHT * bookScale);

	/** The spread the book rests on, or is turning to. */
	const restingSpread = $derived(bookStore.pending?.spreadIndex ?? bookStore.spreadIndex);
	const lastSpread = $derived(Math.ceil(sides.length / 2) - 1);
	const atCover = $derived(restingSpread === 0);
	const atBackCover = $derived(restingSpread === lastSpread);

	/**
	 * A closed book lies in the middle of the table: with only one side
	 * filled, the spread slides a quarter of its width toward that side.
	 */
	const bookShift = $derived.by(() => {
		if (mode !== 'spread') return 0;
		const quarter = (SPREAD_WIDTH * bookScale) / 4;
		return atCover ? -quarter : atBackCover ? quarter : 0;
	});

	/** In a spread only a filled side can be clicked; a phone page has two halves. */
	const showBackArea = $derived(!atCover);
	const showForwardArea = $derived(mode === 'single' || !atBackCover);

	/** Pages fetched ahead of need: whatever the next forward step will show. */
	const preloadPages = $derived(
		pagesToPreload(
			{ spreadIndex: bookStore.spreadIndex, side: bookStore.side },
			mode,
			sides.length
		).flatMap((index) => {
			const face = sides[index];
			return face?.kind === 'page' ? [face.page] : [];
		})
	);

	function measure() {
		if (!viewport) return;
		const rect = viewport.getBoundingClientRect();
		avail = { w: rect.width - MARGIN * 2, h: rect.height - MARGIN * 2 };
		bookStore.setMode(viewModeFor(avail.w, avail.h));
	}

	/** Whether the browser view is pinch-zoomed; drags then pan it instead. */
	let pinchZoomed = $state(false);

	function trackPinchZoom() {
		pinchZoomed = (window.visualViewport?.scale ?? 1) > 1.05;
	}

	/** Swiping follows the paper: dragging it left brings the next page. */
	function handleSwipe(direction: SwipeDirection) {
		if (direction === 'left') bookStore.next();
		else bookStore.prev();
	}

	function handleKeyDown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowRight':
			case 'PageDown':
				event.preventDefault();
				bookStore.next();
				break;
			case 'ArrowLeft':
			case 'PageUp':
				event.preventDefault();
				bookStore.prev();
				break;
			case 'Escape':
				event.preventDefault();
				bookStore.goToCover();
				break;
		}
	}

	onMount(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (viewport) observer.observe(viewport);
		window.addEventListener('resize', measure);
		window.addEventListener('keydown', handleKeyDown);
		window.visualViewport?.addEventListener('resize', trackPinchZoom);
		return () => {
			window.visualViewport?.removeEventListener('resize', trackPinchZoom);
			observer.disconnect();
			window.removeEventListener('resize', measure);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:head>
	{#each preloadPages as page (page.id)}
		<link
			rel="preload"
			as="image"
			type="image/avif"
			fetchpriority="low"
			imagesrcset={pageSources(page).avif}
			imagesizes={PAGE_SIZES}
		/>
	{/each}
</svelte:head>

<div
	bind:this={viewport}
	class="scene"
	class:pannable={mode === 'single' && !pinchZoomed}
	use:swipe={{
		enabled: () => mode === 'single' && !pinchZoomed,
		onSwipe: handleSwipe
	}}
	role="region"
	aria-label={fillCopy(bookUiCopy.experience.regionLabel, { title: bookMeta.title })}
>
	<!-- Laid out by script, so it stays hidden until the screen is measured. -->
	<div
		class="book"
		class:book--measured={avail !== null}
		style:width={`${bookBoxWidth}px`}
		style:height={`${bookBoxHeight}px`}
		style:transform={`translateX(${bookShift}px)`}
	>
		{#if mode === 'spread'}
			<BookSpread
				{sides}
				scale={bookScale}
				sizes={PAGE_SIZES}
				onFlipEnd={() => bookStore.completeTransition()}
			/>
		{:else}
			<BookSinglePage
				{sides}
				scale={bookScale}
				sizes={PAGE_SIZES}
				onTransitionEnd={() => bookStore.completeTransition()}
			/>
		{/if}

		<!-- The right of the book goes forward, the left goes back. Forward
		     comes first so it is the first stop for the keyboard. -->
		{#if showForwardArea}
			<button
				type="button"
				class="page-area page-area--forward"
				class:page-area--whole={!showBackArea && mode === 'single'}
				aria-label={atCover ? bookUiCopy.experience.openLabel : bookUiCopy.reader.nextRegionLabel}
				onclick={() => bookStore.next()}
			></button>
		{/if}
		{#if showBackArea}
			<button
				type="button"
				class="page-area page-area--back"
				aria-label={bookUiCopy.reader.previousRegionLabel}
				onclick={() => bookStore.prev()}
			></button>
		{/if}
	</div>
</div>

<style>
	/* A light table: warm parchment, a little brighter under the book. */
	.scene {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background-color: #f1e4c6;
		background-image: radial-gradient(70% 60% at 50% 45%, #fbf4e1 0%, transparent 100%);
	}

	/* Vertical gestures and pinch stay with the browser; swipes turn the page. */
	.pannable {
		touch-action: pan-y pinch-zoom;
	}

	.book {
		position: relative;
		flex: none;
		visibility: hidden;
	}
	.book--measured {
		visibility: visible;
	}

	.page-area {
		position: absolute;
		top: 0;
		z-index: 30;
		width: 50%;
		height: 100%;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.page-area--back {
		left: 0;
	}
	.page-area--forward {
		right: 0;
	}
	/* A phone's cover has nothing behind it: the whole page opens the book. */
	.page-area--whole {
		width: 100%;
	}
	.page-area:focus-visible {
		outline: 3px solid #b4691f;
		outline-offset: -3px;
	}

	/* The book slides to or from the middle of the table as a cover turns. */
	@media (prefers-reduced-motion: no-preference) {
		.book--measured {
			transition: transform 700ms cubic-bezier(0.45, 0, 0.55, 1);
		}
	}
</style>
