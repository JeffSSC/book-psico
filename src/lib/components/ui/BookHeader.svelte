<script lang="ts">
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookMeta } from '../../data/bookMeta';
	import { bookUiCopy } from '../../data/uiCopy';
	import type { BookPage } from '../../types/book';

	let { currentPage }: { currentPage?: BookPage } = $props();
</script>

<header
	class="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 select-none sm:py-4"
>
	<!-- Left: Table of Contents button -->
	<button
		type="button"
		onclick={() => bookStore.toggleTableOfContents()}
		class="group flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300/80 bg-stone-100/80 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-2xs transition-all hover:bg-stone-200/80 hover:text-stone-900 active:scale-95"
		title={bookUiCopy.tableOfContents.buttonTitle}
		aria-label={bookUiCopy.tableOfContents.buttonLabel}
	>
		<svg
			class="h-4 w-4 text-stone-500 group-hover:text-stone-800"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 12h16M4 18h7"
			/>
		</svg>
		<span class="hidden sm:inline">{bookUiCopy.tableOfContents.buttonLabel}</span>
	</button>

	<!-- Center: Book / Chapter Title -->
	<div class="px-2 text-center">
		<h2 class="font-serif text-xs font-bold tracking-wide text-stone-800 sm:text-sm">
			{bookMeta.title}
		</h2>
		{#if currentPage?.chapterTitle}
			<p
				class="max-w-[200px] truncate text-[10px] font-medium tracking-wider text-amber-800 uppercase sm:max-w-xs"
			>
				{currentPage.chapterTitle}
			</p>
		{/if}
	</div>

	<!-- Right: Sound Toggle -->
	<button
		type="button"
		onclick={() => bookStore.toggleAudio()}
		class="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300/80 bg-stone-100/80 px-2.5 py-1.5 text-xs font-medium shadow-2xs transition-all hover:bg-stone-200/80 active:scale-95 {bookStore.audioEnabled
			? 'text-stone-800'
			: 'text-stone-400'}"
		title={bookStore.audioEnabled ? bookUiCopy.audio.onTitle : bookUiCopy.audio.offTitle}
		aria-label={bookUiCopy.audio.toggleLabel}
	>
		{#if bookStore.audioEnabled}
			<svg class="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
				/>
			</svg>
			<span class="hidden text-[11px] text-stone-600 sm:inline">{bookUiCopy.audio.onLabelLong}</span
			>
		{:else}
			<svg class="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
				/>
			</svg>
			<span class="hidden text-[11px] text-stone-400 sm:inline"
				>{bookUiCopy.audio.offLabelLong}</span
			>
		{/if}
	</button>
</header>
