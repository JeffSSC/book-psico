<script lang="ts">
	import type { BookPage } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookMeta } from '../../data/bookMeta';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';

	let { page }: { page: BookPage } = $props();

	// Dilemma answers live in the store so they persist across sessions.
	const selectedOption = $derived(bookStore.selectedOptions[page.id] ?? null);

	function selectOption(id: string) {
		bookStore.selectOptionForPage(page.id, id);
	}

	function navigateToPage(pageNum: number) {
		bookStore.goToPage(pageNum - 1);
	}
</script>

<div class="sheet flex h-full w-full flex-col justify-between text-[#24211d]">
	{#if page.type === 'cover'}
		<!-- LUXURY MINIMALIST TITLE PAGE -->
		<div class="my-auto flex flex-col items-center justify-center space-y-6 text-center">
			<!-- Visual Motif: Golden Stage Spotlight & Concentric Circle -->
			<div
				class="relative flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/70 bg-gradient-to-b from-amber-100/90 to-amber-200/50 shadow-xs"
			>
				<div class="absolute inset-2 rounded-full border border-dashed border-amber-500/40"></div>
				<svg
					class="h-10 w-10 text-amber-800/80"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.3"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.3"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					/>
				</svg>
				<div
					class="absolute -bottom-2.5 rounded-full border border-amber-300/90 bg-amber-50 px-3 py-0.5 text-[9px] font-semibold tracking-widest text-amber-900 uppercase shadow-2xs"
				>
					{bookMeta.titlePageDom.badge}
				</div>
			</div>

			<div class="max-w-sm space-y-2.5 px-2">
				<p class="font-sans text-[10px] font-semibold tracking-[0.3em] text-stone-500 uppercase">
					{bookMeta.titlePageDom.kicker}
				</p>
				<h1 class="font-serif text-[32px] leading-tight font-bold tracking-tight text-stone-900">
					{page.title}
				</h1>
				<div class="mx-auto my-2 h-0.5 w-14 bg-amber-600/50"></div>
				<p class="font-serif text-sm leading-relaxed text-stone-700 italic">{page.subtitle}</p>
			</div>

			{#if page.footerNote}
				<p class="max-w-xs pt-3 font-serif text-xs text-stone-500 italic">{page.footerNote}</p>
			{/if}
		</div>
	{:else if page.type === 'index'}
		<!-- INDEX / TABLE OF CONTENTS PAGE -->
		<div class="space-y-5">
			<div class="border-b border-stone-200/90 pb-2.5">
				<span class="font-sans text-[10px] font-semibold tracking-widest text-amber-800 uppercase">
					{page.chapterTitle || bookUiCopy.sections.index}
				</span>
			</div>

			<div class="space-y-1">
				<h2 class="font-serif text-2xl font-bold tracking-tight text-stone-900">
					{page.title || bookUiCopy.sections.indexTitle}
				</h2>
				{#if page.subtitle}
					<p class="font-serif text-xs text-stone-600 italic">{page.subtitle}</p>
				{/if}
			</div>

			{#if page.indexEntries}
				<div class="mt-3 space-y-2.5 pt-1">
					{#each page.indexEntries as entry (entry.pageNumber)}
						<button
							type="button"
							onclick={() => navigateToPage(entry.pageNumber)}
							class="group flex w-full cursor-pointer items-baseline text-left transition-colors hover:text-amber-800"
						>
							<span
								class="font-serif text-[13.5px] font-medium text-stone-800 group-hover:text-amber-900"
							>
								{entry.title}
							</span>
							<span
								class="mx-2 flex-1 border-b border-dotted border-stone-300 transition-colors group-hover:border-amber-400"
							></span>
							<span
								class="font-mono text-xs font-semibold text-stone-500 group-hover:text-amber-800"
							>
								{String(entry.pageNumber).padStart(2, '0')}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else if page.type === 'references'}
		<!-- REFERENCES / BIBLIOGRAPHY PAGE -->
		<div class="space-y-5">
			<div class="border-b border-stone-200/90 pb-2.5">
				<span class="font-sans text-[10px] font-semibold tracking-widest text-amber-800 uppercase">
					{page.chapterTitle || bookUiCopy.sections.references}
				</span>
			</div>

			<div class="space-y-1">
				<h2 class="font-serif text-[24px] font-bold tracking-tight text-stone-900">
					{page.title || bookUiCopy.sections.referencesTitle}
				</h2>
				{#if page.subtitle}
					<p class="font-serif text-xs text-stone-600 italic">{page.subtitle}</p>
				{/if}
			</div>

			{#if page.references}
				<div class="space-y-3.5 pt-1">
					{#each page.references as ref, i (i)}
						<div
							class="border-l-2 border-stone-200 pl-3 font-serif text-[13px] leading-relaxed text-stone-700"
						>
							<span class="font-bold text-stone-900">{ref.author}</span>
							<span class="text-stone-500"> ({ref.year}). </span>
							<span class="text-stone-800 italic">{ref.title}. </span>
							<span class="text-stone-600">{ref.source}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if page.type === 'authors'}
		<!-- AUTHORS PROFILE PAGE -->
		<div class="space-y-5">
			<div class="border-b border-stone-200/90 pb-2.5">
				<span class="font-sans text-[10px] font-semibold tracking-widest text-amber-800 uppercase">
					{page.chapterTitle || bookUiCopy.sections.authors}
				</span>
			</div>

			<div class="space-y-1">
				<h2 class="font-serif text-[24px] font-bold tracking-tight text-stone-900">
					{page.title || bookUiCopy.sections.authorsTitle}
				</h2>
				{#if page.subtitle}
					<p class="font-serif text-xs text-stone-600 italic">{page.subtitle}</p>
				{/if}
			</div>

			{#if page.authors}
				<div class="space-y-3.5 pt-1">
					{#each page.authors as author (author.name)}
						<div
							class="flex gap-3.5 rounded-xl border border-stone-200 bg-white/70 p-3.5 shadow-2xs"
						>
							{#if author.avatarText}
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100/90 font-serif text-sm font-bold text-amber-900"
								>
									{author.avatarText}
								</div>
							{/if}
							<div class="space-y-0.5">
								<h3 class="font-serif text-sm font-bold text-stone-900">{author.name}</h3>
								<p class="font-sans text-xs font-medium text-amber-800">{author.role}</p>
								{#if author.avatarText}
									<p class="font-serif text-[13px] leading-relaxed text-stone-600">
										{author.avatarText}
									</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if page.footerNote}
				<p class="pt-1 text-center font-serif text-xs text-stone-500 italic">{page.footerNote}</p>
			{/if}
		</div>
	{:else}
		<!-- STANDARD CHAPTER PAGES (Articles, Epigraphs, Content) -->
		<div class="space-y-4">
			<div class="border-b border-stone-200/90 pb-2">
				{#if page.chapterNumber}
					<span
						class="font-sans text-[10px] font-semibold tracking-widest text-amber-800 uppercase"
					>
						{fillCopy(bookUiCopy.sections.chapterLabelTemplate, {
							number: page.chapterNumber,
							title: page.chapterTitle ?? ''
						})}
					</span>
				{:else}
					<span
						class="font-sans text-[10px] font-semibold tracking-widest text-stone-500 uppercase"
					>
						{page.chapterTitle || bookUiCopy.sections.standard}
					</span>
				{/if}
			</div>

			{#if page.title}
				<div class="space-y-1">
					<h2 class="font-serif text-[24px] leading-snug font-bold tracking-tight text-stone-900">
						{page.title}
					</h2>
					{#if page.subtitle}
						<p class="font-serif text-[13.5px] text-stone-600 italic">{page.subtitle}</p>
					{/if}
				</div>
			{/if}

			{#if page.epigraph}
				<div
					class="relative my-2 rounded-r-lg border-l-2 border-amber-600/60 bg-amber-50/50 py-3 pr-3 pl-4"
				>
					<span class="absolute top-0.5 left-1.5 font-serif text-xl leading-none text-amber-600/30"
						>“</span
					>
					<blockquote class="font-serif text-[13.5px] leading-relaxed text-stone-800 italic">
						{page.epigraph.quote}
					</blockquote>
					<cite
						class="mt-1.5 block text-right font-sans text-[10.5px] font-semibold text-stone-600 not-italic"
					>
						— {page.epigraph.author}
					</cite>
				</div>
			{/if}

			{#if page.paragraphs}
				<div class="space-y-3 font-serif text-[14.5px] leading-relaxed text-stone-700">
					{#each page.paragraphs as paragraph, i (i)}
						<p
							class={i === 0 && !page.epigraph
								? 'first-letter:float-left first-letter:mr-1.5 first-letter:font-serif first-letter:text-[30px] first-letter:leading-[0.85] first-letter:font-bold first-letter:text-stone-900'
								: ''}
						>
							{paragraph}
						</p>
					{/each}
				</div>
			{/if}

			{#if page.callout}
				<div
					class="rounded-lg border p-3 text-[13px] leading-relaxed {page.callout.type ===
					'experiment'
						? 'border-blue-200/80 bg-blue-50/70 text-blue-950'
						: page.callout.type === 'warning'
							? 'border-amber-300 bg-amber-50/90 text-amber-950'
							: 'border-amber-200 bg-amber-50/70 text-stone-800'}"
				>
					{#if page.callout.title}
						<div
							class="mb-1 flex items-center gap-1.5 font-sans text-[10px] font-semibold tracking-wide uppercase {page
								.callout.type === 'experiment'
								? 'text-blue-800'
								: page.callout.type === 'warning'
									? 'text-amber-900'
									: 'text-amber-800'}"
						>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{page.callout.title}</span>
						</div>
					{/if}
					<p class="font-serif whitespace-pre-line">{page.callout.text}</p>
				</div>
			{/if}

			{#if page.interactive}
				<div class="mt-1 rounded-xl border border-stone-300 bg-stone-50/70 p-3.5">
					<div class="mb-2 flex items-center justify-between">
						<span
							class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-800"
						>
							<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
							{bookUiCopy.interactive.badge}
						</span>
						<span class="text-[10px] text-stone-600">{bookUiCopy.interactive.selectHint}</span>
					</div>

					<p class="mb-2.5 font-sans text-[13px] font-semibold text-stone-800">
						{page.interactive.prompt}
					</p>

					{#if page.interactive.options}
						<div class="space-y-2">
							{#each page.interactive.options as opt (opt.id)}
								<button
									type="button"
									onclick={() => selectOption(opt.id)}
									class="w-full cursor-pointer rounded-lg border p-2.5 text-left text-[13px] transition-all {selectedOption ===
									opt.id
										? 'border-amber-600 bg-amber-100/60 font-medium text-stone-900'
										: 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}"
								>
									{opt.label}
								</button>

								{#if selectedOption === opt.id}
									<div
										class="animate-fadeIn rounded-md border-l-2 border-amber-600 bg-stone-100 px-2.5 py-2 font-serif text-[12.5px] text-stone-700 italic"
									>
										<span
											class="mb-0.5 block font-sans text-[9.5px] font-semibold tracking-wider text-stone-900 uppercase not-italic"
										>
											{bookUiCopy.interactive.reflectionTitle}
										</span>
										{opt.reflection}
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if page.footerNote}
				<p class="pt-2 text-center font-serif text-xs text-stone-500 italic">{page.footerNote}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fadeIn {
		animation: fadeIn 0.22s ease-out forwards;
	}
</style>
