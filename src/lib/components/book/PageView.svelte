<script lang="ts">
	import type { BookPage, PageSide } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import PageContentRenderer from './PageContentRenderer.svelte';

	let {
		page,
		side = 'left',
		showNumber = true
	}: {
		page: BookPage;
		/** Which side of the spread this page sits on (drives the gutter shading). */
		side?: PageSide;
		/** Page 01 (the title page) carries no counter. */
		showNumber?: boolean;
	} = $props();

	const total = $derived(bookStore.totalPages);
	const counter = $derived(
		`${String(page.pageNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
	);
</script>

<div class="page" class:page--left={side === 'left'} class:page--right={side === 'right'}>
	<header class="page-head select-none">
		<span class="running">{page.chapterTitle ?? ''}</span>
		{#if showNumber}
			<span class="counter">{counter}</span>
		{/if}
	</header>

	<div class="content">
		<PageContentRenderer {page} />
	</div>

	<div class="grain" aria-hidden="true"></div>
</div>

<style>
	.page {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 512px;
		height: 720px;
		overflow: hidden;
		background: #fdfbf7;
		color: #24211d;
	}

	/* Gutter shading on each page's spine side. */
	.page--left::after,
	.page--right::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 10;
	}
	.page--left::after {
		background: linear-gradient(90deg, transparent calc(100% - 44px), rgba(87, 74, 54, 0.13));
	}
	.page--right::after {
		background: linear-gradient(270deg, transparent calc(100% - 44px), rgba(87, 74, 54, 0.13));
	}

	.page-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 20px 32px 10px;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #a8a29e;
	}

	.running {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.counter {
		font-family: var(--font-mono, ui-monospace, monospace);
		letter-spacing: 0.06em;
		color: #78716c;
	}

	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px 32px 28px;
	}

	.grain {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		opacity: 0.55;
		background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='140'%20height='140'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.85'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='140'%20height='140'%20filter='url(%23n)'%20opacity='0.035'/%3E%3C/svg%3E");
	}
</style>
