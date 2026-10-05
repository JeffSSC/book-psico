<script lang="ts">
	import { onMount } from 'svelte';
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookMeta } from '../../data/bookMeta';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';
	import type { BookPage } from '../../types/book';
	import BookCover from './BookCover.svelte';
	import BookSpread from './BookSpread.svelte';
	import BookSinglePage from './BookSinglePage.svelte';
	import BookHeader from '../ui/BookHeader.svelte';
	import BookFooter from '../ui/BookFooter.svelte';
	import TableOfContentsModal from '../ui/TableOfContentsModal.svelte';
	import { PAGE_HEIGHT, PAGE_WIDTH, SPREAD_HEIGHT, SPREAD_WIDTH, fitScale } from './pageScale';

	/** Strip reserved below the book for the "click to open" hint. */
	const HINT_SPACE = 56;

	/**
	 * Master scene of the 2D top-down book (AD/UI/2D-UI.md).
	 *
	 * Owns the closed/open staging, the framing measurement,
	 * the margin tap zones and the keyboard. Page content, the
	 * leaf and the slide live in BookSpread / BookSinglePage;
	 * the store owns the position and commits it when the
	 * animations report back.
	 */

	let { pages }: { pages: BookPage[] } = $props();

	// Register once so the first paint already knows the page count
	// for the "NN / 12" counters.
	$effect(() => {
		bookStore.registerPages(pages);
	});

	let viewport = $state<HTMLElement | null>(null);
	let avail = $state({ w: 0, h: 0 });

	const uiState = $derived(bookStore.bookUIState);
	const mode = $derived(bookStore.mode);

	const showOpenLayer = $derived(uiState !== 'closed');
	const showClosedLayer = $derived(uiState !== 'opened');

	/**
	 * The closed book shares the open book's scale: exactly
	 * one page tall — half the spread wide — so the cover and
	 * the pages are the same physical object, not two cards.
	 *
	 * The hint strip below the closed book is reserved in both
	 * states, so opening the book never changes its size.
	 */
	const bookScale = $derived(
		mode === 'spread'
			? fitScale(SPREAD_WIDTH, SPREAD_HEIGHT, avail.w, avail.h - HINT_SPACE)
			: fitScale(PAGE_WIDTH, PAGE_HEIGHT, avail.w, avail.h - HINT_SPACE)
	);
	const coverScale = $derived(bookScale);

	/**
	 * The book rests where the spine will be: in spread mode it
	 * sits on the spread's RIGHT half, so its spine edge lands on
	 * the future gutter (the viewport centre line) and the cover
	 * swings left across the desk exactly as a real one does. In
	 * single mode the reading page already occupies the book's own
	 * footprint, so the book stays centred.
	 */
	const coverOffset = $derived(
		mode === 'spread' ? ((SPREAD_WIDTH - PAGE_WIDTH) / 2) * bookScale : 0
	);

	/** Visual width of the framed book on screen. */
	const bookBoxWidth = $derived((mode === 'spread' ? SPREAD_WIDTH : PAGE_WIDTH) * bookScale);

	function measure() {
		if (!viewport) return;
		const rect = viewport.getBoundingClientRect();
		avail = { w: rect.width, h: rect.height };
		if (typeof window !== 'undefined') {
			bookStore.setMode(window.innerWidth < 768 ? 'single' : 'spread');
		}
	}

	/** Outer-margin tap zones: reading area taps never turn pages. */
	function handleBookClick(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, a, [data-interactive]')) return;
		if (uiState !== 'opened' || !viewport) return;

		const rect = viewport.getBoundingClientRect();
		const offsetX = (avail.w - bookBoxWidth) / 2;
		const x = (event.clientX - rect.left - offsetX) / bookBoxWidth;
		if (x < 0 || x > 1) return;

		if (mode === 'spread') {
			if (x < 0.18) bookStore.prev();
			else if (x > 0.82) bookStore.next();
		} else {
			if (x < 0.28) bookStore.prev();
			else if (x > 0.72) bookStore.next();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (bookStore.isTableOfContentsOpen) return;

		const state = bookStore.bookUIState;
		if (state === 'closed' || state === 'closing') {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				bookStore.openBook();
			}
			return;
		}
		if (state !== 'opened') return;

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
				bookStore.closeBook();
				break;
		}
	}

	onMount(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (viewport) observer.observe(viewport);
		window.addEventListener('resize', measure);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div
	class="scene"
	class:anim-opening={uiState === 'opening'}
	class:anim-closing={uiState === 'closing'}
>
	<!-- The chrome stays mounted while the book is closed (hidden and
	     inert) so the book is framed identically in both states. -->
	<header
		class="chrome z-40 flex justify-center"
		class:chrome-off={uiState === 'closed'}
		inert={uiState === 'closed'}
	>
		<BookHeader />
	</header>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- Keyboard handling is global (window keydown) for the whole scene. -->
	<div
		bind:this={viewport}
		class="relative min-h-0 flex-1"
		role="region"
		aria-label={fillCopy(bookUiCopy.experience.regionLabel, { title: bookMeta.title })}
		onclick={handleBookClick}
	>
		{#if showOpenLayer}
			<div class="open-layer">
				{#if mode === 'spread'}
					<BookSpread
						{pages}
						scale={bookScale}
						splay={uiState === 'opening'}
						onFlipEnd={() => bookStore.completeTransition()}
					/>
				{:else}
					<BookSinglePage
						{pages}
						scale={bookScale}
						onTransitionEnd={() => bookStore.completeTransition()}
					/>
				{/if}
			</div>
		{/if}

		{#if showClosedLayer}
			<div class="closed-layer">
				<!-- Book and hint travel together onto the spine line. -->
				<div class="closed-book" style:transform={`translateX(${coverOffset}px)`}>
					<div
						class="cover-slot"
						style:width={`${PAGE_WIDTH * coverScale}px`}
						style:height={`${PAGE_HEIGHT * coverScale}px`}
					>
						<div
							class="cover-scale"
							style:width={`${PAGE_WIDTH}px`}
							style:height={`${PAGE_HEIGHT}px`}
							style:transform={`scale(${coverScale})`}
						>
							<!-- The cover is the book's first leaf: front face is the
							     cover art, back face is the blank reverse of that leaf.
							     Opening swings it about the spine (its left edge),
							     which is where the gutter of the spread will be. -->
							<div
								class="cover-tilt"
								style:width={`${PAGE_WIDTH}px`}
								style:height={`${PAGE_HEIGHT}px`}
							>
								<div class="cover-face">
									<BookCover />
								</div>
								<div class="cover-face cover-face--back" aria-hidden="true"></div>
							</div>
						</div>
					</div>
					<p class="open-hint">{bookUiCopy.experience.openHint}</p>
				</div>
			</div>
		{/if}
	</div>

	<footer
		class="chrome z-40 flex justify-center"
		class:chrome-off={uiState === 'closed'}
		inert={uiState === 'closed'}
	>
		<BookFooter />
	</footer>

	<TableOfContentsModal {pages} />
</div>

<style>
	.scene {
		--cover-dur: 360ms;
		/* Symmetric easing keeps the face swap at the edge-on moment. */
		--cover-ease: cubic-bezier(0.4, 0, 0.6, 1);
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background: #eae6df;
	}

	.open-layer {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.closed-layer {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		perspective: 1200px;
	}

	/* The closed book and its hint, shifted onto the spine line. */
	.closed-book {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		transition: transform 300ms ease;
	}

	/* The 3D context must run unbroken from the scene's
	   perspective down to the leaf hinge, or the swing
	   flattens into an orthographic squash. */
	.cover-slot {
		position: relative;
		transform-style: preserve-3d;
	}

	.cover-scale {
		transform-origin: top left;
		transform-style: preserve-3d;
	}

	.cover-tilt {
		position: relative;
		transform-style: preserve-3d;
	}

	.cover-face {
		position: absolute;
		inset: 0;
		/* Same reasoning as PageLeaf: the two faces are swapped by
		   visibility, never by `backface-visibility` — Chromium decides
		   facing from the face's own transform and culls the face you
		   are supposed to be looking at. */
	}

	/* The reverse of the cover leaf: blank paper, shaded
	   toward the spine the way the inside of a cover is, and
	   casting the shadow of the cover now lying face-down. */
	.cover-face:first-child {
		animation: none;
	}
	.cover-face--back {
		visibility: hidden;
		transform: rotateY(180deg);
		background: linear-gradient(to left, #eee7d9 0%, #fdfbf7 26%, #f7f2e7 100%);
		box-shadow:
			inset 0 0 0 1px rgba(64, 52, 34, 0.07),
			0 6px 20px rgba(20, 16, 10, 0.22);
		/* Decorative: never swallow a click meant for the cover. */
		pointer-events: none;
		animation: none;
	}

	/* Swapped exactly at the edge-on moment (50%, because the easing is
	   symmetric), where neither face is visible anyway. */
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
	/* Closing runs the swap the other way: the back leads, the cover
	   art arrives last. */
	@keyframes face-front-rev {
		0%,
		49.99% {
			visibility: hidden;
		}
		50%,
		100% {
			visibility: visible;
		}
	}
	@keyframes face-back-rev {
		0%,
		49.99% {
			visibility: visible;
		}
		50%,
		100% {
			visibility: hidden;
		}
	}

	/* Hidden (but still occupying its strip) while the book is
	   closed, so the cover and the open pages share one framing. */
	.chrome {
		transition: opacity 240ms ease;
	}

	.chrome-off {
		opacity: 0;
		pointer-events: none;
	}

	.open-hint {
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.75);
		padding: 6px 14px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: #57534e;
		box-shadow: 0 2px 6px rgba(40, 32, 20, 0.18);
		backdrop-filter: blur(4px);
	}

	/* Opening plays out as two honest beats (AD/UI/2D-UI.md §5):
	   the cover swings left about the spine, then page 01 splays
	   left onto the cover it lies on, revealing page 02. The cover
	   has gone before the splay lands, so the two never stack up
	   and the book is never read as three pages. Page 01's splay
	   lives in BookSpread and shares these timings. */
	@media (prefers-reduced-motion: no-preference) {
		/* The turning leaf sits above the pages arriving beneath it. */
		.anim-opening .closed-layer {
			z-index: 20;
		}
		.anim-opening .open-layer {
			z-index: 10;
			animation: layer-in 330ms ease-out 330ms both;
		}
		.anim-opening .cover-tilt {
			transform-origin: left center;
			animation:
				cover-open var(--cover-dur) var(--cover-ease) both,
				cover-away 180ms ease-in 280ms both;
		}
		.anim-opening .cover-face:first-child {
			animation: face-front var(--cover-dur) var(--cover-ease) both;
		}
		.anim-opening .cover-face--back {
			animation: face-back var(--cover-dur) var(--cover-ease) both;
		}
		.anim-opening .open-hint {
			animation: hint-away 260ms ease-in both;
		}

		/* Closing runs the sequence backwards. */
		.anim-closing .open-layer {
			animation: layer-out 330ms ease-in both;
			pointer-events: none;
		}
		.anim-closing .closed-layer {
			animation: layer-in 330ms ease-out 330ms both;
		}
		.anim-closing .cover-tilt {
			transform-origin: left center;
			animation: cover-close var(--cover-dur) var(--cover-ease) 330ms both;
		}
		.anim-closing .cover-face:first-child {
			animation: face-front-rev var(--cover-dur) var(--cover-ease) 330ms both;
		}
		.anim-closing .cover-face--back {
			animation: face-back-rev var(--cover-dur) var(--cover-ease) 330ms both;
		}
	}

	/* Reduced motion: swap the layers instantly — the layer that
	   would otherwise sit on top is simply not rendered. */
	@media (prefers-reduced-motion: reduce) {
		.anim-opening .closed-layer {
			display: none;
		}
		.anim-closing .open-layer {
			display: none;
		}
	}

	@keyframes cover-open {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(-180deg);
		}
	}
	@keyframes cover-close {
		from {
			transform: rotateY(-180deg);
		}
		to {
			transform: rotateY(0deg);
		}
	}
	@keyframes cover-away {
		to {
			opacity: 0;
		}
	}
	@keyframes layer-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes layer-out {
		to {
			opacity: 0;
		}
	}
	@keyframes hint-away {
		to {
			opacity: 0;
		}
	}
</style>
