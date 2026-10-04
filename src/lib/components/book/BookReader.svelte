<script lang="ts">
	import { onMount } from 'svelte';
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookUiCopy } from '../../data/uiCopy';
	import type { BookPage } from '../../types/book';
	import PageContentRenderer from './PageContentRenderer.svelte';

	let { pages }: { pages: BookPage[] } = $props();

	// Initialize total pages
	$effect(() => {
		bookStore.setTotalPages(pages.length);
	});

	// Active pages derived from store
	let currentIndex = $derived(bookStore.currentPageIndex);
	let currentPage = $derived(pages[currentIndex] || pages[0]);
	let nextPage = $derived(pages[currentIndex + 1] || null);
	let prevPage = $derived(pages[currentIndex - 1] || null);

	// Page number format: "02 / 12"
	let pageNumberFormatted = $derived(
		`${String(currentIndex + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`
	);

	// Animation internal state
	let flippingSheet = $state<'forward' | 'backward' | null>(null);

	// Touch / Drag gesture tracking
	let startX = $state<number>(0);
	let startY = $state<number>(0);
	let isDragging = $state<boolean>(false);

	function triggerNext() {
		if (!bookStore.canGoNext || flippingSheet !== null) return;
		flippingSheet = 'forward';
		bookStore.nextPage();
		setTimeout(() => {
			flippingSheet = null;
		}, 520);
	}

	function triggerPrev() {
		if (!bookStore.canGoPrev || flippingSheet !== null) return;
		flippingSheet = 'backward';
		bookStore.prevPage();
		setTimeout(() => {
			flippingSheet = null;
		}, 520);
	}

	function triggerCloseBook() {
		bookStore.closeBook();
	}

	// Keyboard navigation
	function handleKeyDown(event: KeyboardEvent) {
		if (!bookStore.isBookOpen) return;

		if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
			event.preventDefault();
			triggerNext();
		} else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
			event.preventDefault();
			triggerPrev();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			triggerCloseBook();
		}
	}

	// Pointer gestures for touch / swipe
	function handlePointerDown(e: PointerEvent) {
		if (flippingSheet !== null) return;
		const target = e.target as HTMLElement;
		if (target.closest('button') || target.closest('a') || target.closest('input')) {
			return;
		}
		startX = e.clientX;
		startY = e.clientY;
		isDragging = true;
	}

	function handlePointerUp(e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;
		const deltaX = e.clientX - startX;
		const deltaY = Math.abs(e.clientY - startY);

		// Horizontal swipe threshold (> 45px) with minimal vertical deviation
		if (Math.abs(deltaX) > 45 && deltaY < 120) {
			if (deltaX < 0) {
				triggerNext();
			} else {
				triggerPrev();
			}
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div
	class="relative flex h-[100dvh] h-full w-full max-w-2xl items-center justify-center select-none sm:max-w-3xl"
	style="perspective: 2000px;"
>
	<!-- THE PAGE CONTAINER (Warm paper #FDFBF7, 100vh height, clean book spine hint) -->
	<div
		class="relative flex h-[100dvh] h-full w-full flex-col justify-between overflow-hidden bg-[#FDFBF7] shadow-[0_0_40px_rgba(0,0,0,0.06)]"
		role="region"
		aria-label={bookUiCopy.reader.regionLabel}
		onpointerdown={handlePointerDown}
		onpointerup={handlePointerUp}
	>
		<!-- TOP BOOKMARK RIBBON (Closes the book to 3D overview) -->
		<div class="absolute top-0 left-8 z-40 sm:left-12">
			<button
				type="button"
				onclick={triggerCloseBook}
				class="group relative flex cursor-pointer flex-col items-center transition-transform duration-200 hover:translate-y-1 focus:outline-none"
				title={bookUiCopy.reader.closeTitle}
				aria-label={bookUiCopy.reader.closeLabel}
			>
				<!-- Silk Bookmark Ribbon Body -->
				<div
					class="h-10 w-6 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 shadow-md sm:h-12 sm:w-7"
				>
					<div class="mx-auto h-full w-0.5 bg-amber-500/30"></div>
				</div>
				<!-- Ribbon Chevron V-Cut Bottom -->
				<div
					class="h-3 w-6 bg-amber-900 sm:h-3.5 sm:w-7"
					style="clip-path: polygon(0 0, 100% 0, 50% 100%);"
				></div>
				<!-- Hover Tooltip Hint -->
				<span
					class="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 rounded bg-stone-900/90 px-2 py-0.5 font-sans text-[10px] font-medium whitespace-nowrap text-stone-200 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
				>
					{bookUiCopy.reader.closeLabel}
				</span>
			</button>
		</div>

		<!-- TOP RIGHT: DISCREET PAGE INDICATOR -->
		<div
			class="pointer-events-none absolute top-4 right-5 z-30 font-mono text-[11px] font-medium text-stone-600 transition-opacity duration-200 sm:top-6 sm:right-8 sm:text-xs {currentPage.type ===
			'cover'
				? 'opacity-0'
				: 'opacity-100'}"
		>
			{pageNumberFormatted}
		</div>

		<!-- STATIC BASE PAGE LAYER -->
		<div class="absolute inset-0 overflow-hidden bg-[#FDFBF7]">
			{#if flippingSheet === 'forward' && nextPage}
				<!-- Underneath page when leafing forward: NEXT PAGE -->
				<PageContentRenderer page={nextPage} />
			{:else if flippingSheet === 'backward' && prevPage}
				<!-- Underneath page when leafing backward: CURRENT PAGE -->
				<PageContentRenderer page={currentPage} />
			{:else}
				<!-- Normal state: CURRENT PAGE -->
				<PageContentRenderer page={currentPage} />
			{/if}
		</div>

		<!-- FLAT 3D TURNING SHEET (Active only during flip transition) -->
		{#if flippingSheet === 'forward'}
			<div
				class="preserve-3d animate-turnPageForward pointer-events-none absolute inset-0 z-20 origin-left"
				style="transform-origin: left center;"
			>
				<!-- FRONT OF TURNING SHEET (Current Page turning away) -->
				<div class="absolute inset-0 overflow-hidden bg-[#FDFBF7] backface-hidden">
					<PageContentRenderer page={currentPage} />
				</div>

				<!-- BACK OF TURNING SHEET (Flat reverse paper) -->
				<div
					class="absolute inset-0 overflow-hidden bg-[#F7F4EA] backface-hidden"
					style="transform: rotateY(180deg);"
				></div>
			</div>
		{:else if flippingSheet === 'backward' && prevPage}
			<div
				class="preserve-3d animate-turnPageBackward pointer-events-none absolute inset-0 z-20 origin-left"
				style="transform-origin: left center;"
			>
				<!-- FRONT OF RETURNING SHEET (Prev page returning) -->
				<div class="absolute inset-0 overflow-hidden bg-[#FDFBF7] backface-hidden">
					<PageContentRenderer page={prevPage} />
				</div>

				<!-- BACK OF RETURNING SHEET -->
				<div
					class="absolute inset-0 overflow-hidden bg-[#F7F4EA] backface-hidden"
					style="transform: rotateY(180deg);"
				></div>
			</div>
		{/if}

		<!-- BOTTOM CORNER NAVIGATION BUTTONS -->
		<!-- Bottom Left: Anterior (Backward) -->
		<button
			type="button"
			onclick={triggerPrev}
			disabled={!bookStore.canGoPrev}
			class="group absolute bottom-4 left-5 z-30 flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300/90 bg-stone-100/90 px-3.5 py-1.5 text-xs font-medium text-stone-800 shadow-2xs transition-all hover:bg-stone-200 active:scale-95 disabled:pointer-events-none disabled:opacity-0 sm:bottom-6 sm:left-8"
			aria-label={bookUiCopy.reader.previousRegionLabel}
		>
			<svg
				class="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			<span>{bookUiCopy.chrome.previousLabel}</span>
		</button>

		<!-- Bottom Right: Próxima (Forward) -->
		<button
			type="button"
			onclick={triggerNext}
			disabled={!bookStore.canGoNext}
			class="group absolute right-5 bottom-4 z-30 flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300/90 bg-stone-100/90 px-3.5 py-1.5 text-xs font-medium text-stone-800 shadow-2xs transition-all hover:bg-stone-200 active:scale-95 disabled:pointer-events-none disabled:opacity-0 sm:right-8 sm:bottom-6"
			aria-label={bookUiCopy.reader.nextRegionLabel}
		>
			<span>{bookUiCopy.chrome.nextLabel}</span>
			<svg
				class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>
</div>

<style>
	.preserve-3d {
		transform-style: preserve-3d;
	}
	.backface-hidden {
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	/* FLAT 3D FORWARD FLIP ANIMATION */
	@keyframes turnPageForward {
		0% {
			transform: rotateY(0deg);
		}
		100% {
			transform: rotateY(-180deg);
		}
	}
	.animate-turnPageForward {
		animation: turnPageForward 0.5s cubic-bezier(0.25, 0.9, 0.35, 1) forwards;
		will-change: transform;
	}

	/* FLAT 3D BACKWARD FLIP ANIMATION */
	@keyframes turnPageBackward {
		0% {
			transform: rotateY(-180deg);
		}
		100% {
			transform: rotateY(0deg);
		}
	}
	.animate-turnPageBackward {
		animation: turnPageBackward 0.5s cubic-bezier(0.25, 0.9, 0.35, 1) forwards;
		will-change: transform;
	}
</style>
