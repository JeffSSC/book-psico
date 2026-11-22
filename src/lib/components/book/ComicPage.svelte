<script lang="ts">
	import type { ComicPage, PageSide } from '../../types/book';
	import { pageSources } from '../../data/comic';

	/**
	 * One page of art, filling its positioning parent. The page's dominant
	 * colour is painted underneath so the box is never blank while the
	 * image decodes.
	 */

	let {
		page,
		sizes,
		eager = false,
		side
	}: {
		page: ComicPage;
		/** On-screen width of the page, for the browser's source choice. */
		sizes: string;
		/** Fetch at once and decode before painting: the page is on screen now. */
		eager?: boolean;
		/** Side of the spread the page sits on; shades its spine edge. */
		side?: PageSide;
	} = $props();

	const sources = $derived(pageSources(page));
</script>

<div
	class="page"
	class:page--left={side === 'left'}
	class:page--right={side === 'right'}
	style:background-color={page.color}
>
	<picture>
		<source type="image/avif" srcset={sources.avif} {sizes} />
		<source type="image/webp" srcset={sources.webp} {sizes} />
		<img
			src={sources.src}
			alt={page.alt}
			width={sources.width}
			height={sources.height}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : 'auto'}
			decoding={eager ? 'sync' : 'async'}
			draggable="false"
		/>
	</picture>
</div>

<style>
	.page {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
	}

	/* Paper curving into the binding: dark at the spine, a soft sheen
	   where the page crests, then flat. */
	.page--left::after,
	.page--right::after {
		--spine:
			var(--spine-side), rgba(24, 14, 4, 0.5) 0%, rgba(24, 14, 4, 0.26) 1.2%,
			rgba(24, 14, 4, 0.1) 4%, rgba(255, 250, 235, 0.09) 8%, transparent 15%;
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(var(--spine));
	}
	.page--left::after {
		--spine-side: to left;
	}
	.page--right::after {
		--spine-side: to right;
	}
</style>
