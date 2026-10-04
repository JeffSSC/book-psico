<script lang="ts">
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';
	import type { BookPage } from '../../types/book';

	let { pages }: { pages: BookPage[] } = $props();

	function jumpToPage(index: number) {
		bookStore.goToPage(index);
		bookStore.toggleTableOfContents(false);
	}
</script>

<svelte:window
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Escape' && bookStore.isTableOfContentsOpen) {
			bookStore.toggleTableOfContents(false);
		}
	}}
/>

{#if bookStore.isTableOfContentsOpen}
	<!-- Modal wrapper -->
	<div
		class="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs transition-opacity"
		role="dialog"
		aria-modal="true"
		aria-label={bookUiCopy.tableOfContents.dialogLabel}
	>
		<!-- Backdrop click overlay button -->
		<button
			type="button"
			class="absolute inset-0 -z-10 h-full w-full cursor-default bg-transparent focus:outline-none"
			onclick={() => bookStore.toggleTableOfContents(false)}
			tabindex="-1"
			aria-label={bookUiCopy.tableOfContents.closeLabel}
		></button>
		<!-- Modal Container -->
		<div
			class="animate-slideUp relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-300 bg-[#faf7f2] shadow-2xl"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-stone-200 bg-stone-100/70 px-6 py-4"
			>
				<div>
					<h3 class="font-serif text-lg font-bold text-stone-900">
						{bookUiCopy.tableOfContents.heading}
					</h3>
					<p class="text-xs text-stone-500">{bookUiCopy.tableOfContents.subtitle}</p>
				</div>
				<button
					type="button"
					onclick={() => bookStore.toggleTableOfContents(false)}
					class="cursor-pointer rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800"
					aria-label={bookUiCopy.tableOfContents.closeLabel}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Page List -->
			<div class="space-y-2 overflow-y-auto p-4">
				{#each pages as page, index (page.id)}
					<button
						type="button"
						onclick={() => jumpToPage(index)}
						class="group flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left transition-all {bookStore.currentPageIndex ===
						index
							? 'border-amber-500/80 bg-amber-100/70 shadow-xs'
							: 'border-stone-200/90 bg-white hover:bg-stone-50'}"
					>
						<div class="flex items-center gap-3">
							<span
								class="flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors {bookStore.currentPageIndex ===
								index
									? 'bg-amber-700 text-amber-50'
									: 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'}"
							>
								{page.pageNumber}
							</span>

							<div>
								<div class="flex items-center gap-2">
									<h4
										class="font-serif text-sm font-semibold text-stone-900 group-hover:text-amber-900"
									>
										{page.title ||
											(page.type === 'cover'
												? bookUiCopy.tableOfContents.coverTitleFallback
												: bookUiCopy.tableOfContents.pageTitleFallback)}
									</h4>
									{#if page.type === 'interactive'}
										<span
											class="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-800 uppercase"
										>
											{bookUiCopy.tableOfContents.interactiveBadge}
										</span>
									{/if}
								</div>
								{#if page.subtitle}
									<p class="max-w-xs truncate text-xs text-stone-500">{page.subtitle}</p>
								{:else if page.chapterTitle}
									<p class="text-xs text-stone-500">{page.chapterTitle}</p>
								{/if}
							</div>
						</div>

						<div class="text-stone-400 transition-colors group-hover:text-amber-700">
							{#if bookStore.currentPageIndex === index}
								<span class="text-xs font-medium text-amber-800"
									>{bookUiCopy.tableOfContents.readingNow}</span
								>
							{:else}
								<svg
									class="h-4 w-4 transform transition-transform group-hover:translate-x-1"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5l7 7-7 7"
									/>
								</svg>
							{/if}
						</div>
					</button>
				{/each}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-3 text-xs text-stone-500"
			>
				<span
					>{fillCopy(bookUiCopy.tableOfContents.progressTemplate, {
						percent: bookStore.progressPercent
					})}</span
				>
				<span class="font-mono"
					>{fillCopy(bookUiCopy.tableOfContents.totalTemplate, { count: pages.length })}</span
				>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.animate-fadeIn {
		animation: fadeIn 0.2s ease-out forwards;
	}
	.animate-slideUp {
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
</style>
