<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookFace } from '../../types/book';
	import { bookStore } from '../../stores/bookStore.svelte';
	import FaceView from './FaceView.svelte';
	import PageLeaf from './PageLeaf.svelte';
	import { PAGE_HEIGHT, PAGE_WIDTH } from './pageScale';
	import { prefersReducedMotion } from './reducedMotion';

	/**
	 * The phone view: one face at a time, turned like a single sheet hinged
	 * on its left edge. Going forward the sheet on screen lifts away and
	 * shows the next one beneath; going back the previous sheet returns and
	 * lands on top.
	 */

	let {
		sides,
		scale,
		sizes,
		onTransitionEnd
	}: {
		/** The sides of the book in order; `null` is an empty side. */
		sides: (BookFace | null)[];
		/** Uniform scale computed by the scene (fitScale helpers). */
		scale: number;
		/** `sizes` of one page image, shared with the scene's preloads. */
		sizes: string;
		/** Commit the pending position when the turn finishes. */
		onTransitionEnd: () => void;
	} = $props();

	let reduced = $state(false);
	onMount(() => {
		reduced = prefersReducedMotion();
	});

	const pending = $derived(bookStore.pending);
	const direction = $derived(bookStore.flipDirection);
	const isFlipping = $derived(bookStore.isFlipping);
	const turning = $derived(isFlipping && !reduced);

	const currentIdx = $derived(bookStore.pageIndexOfSide);
	const targetIdx = $derived(
		isFlipping && pending
			? pending.spreadIndex * 2 + (pending.side === 'right' ? 1 : 0)
			: currentIdx
	);

	/** The sheet in the air: the one leaving (forward) or the one returning (back). */
	const leafFace = $derived(sides[direction === 'next' ? currentIdx : targetIdx]);
	/** The sheet lying flat beneath it. */
	const restingFace = $derived(
		sides[turning ? (direction === 'next' ? targetIdx : currentIdx) : targetIdx]
	);

	// Reduced motion has nothing to animate, so the position is
	// committed on the next frame instead of on an animation end.
	$effect(() => {
		if (isFlipping && reduced) {
			const frame = requestAnimationFrame(() => onTransitionEnd());
			return () => cancelAnimationFrame(frame);
		}
	});
</script>

<div
	class="single-frame"
	style:width={`${PAGE_WIDTH * scale}px`}
	style:height={`${PAGE_HEIGHT * scale}px`}
	style:--page-w={`${PAGE_WIDTH}px`}
	style:--page-h={`${PAGE_HEIGHT}px`}
>
	<div class="single" style:transform={`scale(${scale})`}>
		{#if restingFace}
			<div class="sheet">
				<FaceView face={restingFace} {sizes} />
			</div>
		{/if}

		{#if turning && leafFace}
			<div class="sheet sheet--turning">
				<PageLeaf
					frontPage={leafFace}
					backPage={null}
					direction="next"
					reverse={direction === 'prev'}
					{sizes}
					onEnd={onTransitionEnd}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.single-frame {
		position: relative;
		flex: none;
	}

	.single {
		position: relative;
		width: var(--page-w);
		height: var(--page-h);
		perspective: 1700px;
		/* Fitted to the frame by the scene's scale. */
		transform-origin: top left;
	}

	.sheet {
		position: absolute;
		inset: 0;
		box-shadow:
			0 2px 4px rgba(74, 48, 16, 0.3),
			0 14px 32px rgba(74, 48, 16, 0.35);
	}

	/* Keeps the leaf's 3D in the page's perspective context. */
	.sheet--turning {
		box-shadow: none;
		transform-style: preserve-3d;
	}
</style>
