<script lang="ts">
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';

	let progressPercent = $derived(bookStore.progressPercent);
	let currentPageNumber = $derived(bookStore.currentPageIndex + 1);
	let totalPagesCount = $derived(bookStore.totalPages);
</script>

<footer class="mx-auto w-full max-w-2xl px-4 py-3 select-none sm:py-4">
	<div class="flex flex-col gap-2.5">
		<!-- Main Controls Row -->
		<div class="flex items-center justify-between">
			<!-- Prev Button -->
			<button
				type="button"
				onclick={() => bookStore.prevPage()}
				disabled={!bookStore.canGoPrev}
				class="group flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium shadow-2xs transition-all active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35 {bookStore.canGoPrev
					? 'border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200'
					: 'border-stone-200 bg-stone-50 text-stone-400'}"
				aria-label={bookUiCopy.reader.previousRegionLabel}
			>
				<svg
					class="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				<span>{bookUiCopy.chrome.previousLabel}</span>
			</button>

			<!-- Page Counter & Keyboard Hint -->
			<div class="flex flex-col items-center">
				<span class="font-mono text-xs font-medium text-stone-700">
					{fillCopy(bookUiCopy.chrome.pageCounterTemplate, {
						current: currentPageNumber,
						total: totalPagesCount
					})}
				</span>
				<span class="hidden text-[10px] text-stone-600 sm:inline">
					{bookUiCopy.chrome.keyboardHint}
				</span>
			</div>

			<!-- Next Button -->
			<button
				type="button"
				onclick={() => bookStore.nextPage()}
				disabled={!bookStore.canGoNext}
				class="group flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium shadow-2xs transition-all active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35 {bookStore.canGoNext
					? 'border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200'
					: 'border-stone-200 bg-stone-50 text-stone-400'}"
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

		<!-- Interactive Reading Progress Bar -->
		<div class="flex w-full items-center gap-3">
			<div class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200/80">
				<div
					class="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-700 transition-all duration-300 ease-out"
					style="width: {progressPercent}%;"
				></div>
			</div>
			<span class="min-w-[28px] text-right font-mono text-[10px] font-medium text-stone-600">
				{progressPercent}%
			</span>
		</div>
	</div>
</footer>
