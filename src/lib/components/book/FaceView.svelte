<script lang="ts">
	import type { BookFace, PageSide } from '../../types/book';
	import BackCover from './BackCover.svelte';
	import ComicPage from './ComicPage.svelte';

	/** One face of the book, filling its positioning parent. */

	let {
		face,
		sizes,
		side
	}: {
		face: BookFace;
		/** `sizes` of a page image. */
		sizes: string;
		/** Side of the spread the face sits on; shades its spine edge. */
		side?: PageSide;
	} = $props();
</script>

{#if face.kind === 'page'}
	<ComicPage page={face.page} {sizes} {side} eager />
{:else}
	<BackCover />
{/if}
