<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookFace, FlipDirection, PageSide } from '../../types/book';
	import FaceView from './FaceView.svelte';

	/**
	 * The turning leaf, bending like paper. It fills its positioning parent
	 * (a spread half, or the single page of a phone) and hinges on the spine:
	 * "next" on its LEFT edge, "prev" on its RIGHT edge. The sheet is cut
	 * into vertical strips, each hinged on the one before; the free edge
	 * lifts first and the curl travels to the spine, so the paper bends
	 * instead of swinging as a board. `reverse` plays a turn backwards: the
	 * sheet comes back from the far side and lands.
	 */

	let {
		frontPage,
		backPage,
		frontSide = 'right',
		backSide = 'left',
		direction,
		reverse = false,
		sizes,
		onEnd
	}: {
		/** The face currently on top (the page being turned away from). */
		frontPage: BookFace;
		/** The reverse of the sheet; `null` is blank paper. */
		backPage: BookFace | null;
		frontSide?: PageSide;
		backSide?: PageSide;
		direction: FlipDirection;
		/** Play the turn backwards, ending with the front face lying flat. */
		reverse?: boolean;
		/** On-screen width of a page, for the browser's source choice. */
		sizes: string;
		/** Fires when the turn animation finishes (commit the position). */
		onEnd: () => void;
	} = $props();

	/** Strips the sheet is cut into; more is smoother and heavier. */
	const STRIPS = 8;
	const DURATION = 760;
	/** Share of the turn by which the free edge runs ahead of the spine. */
	const LEAD = 0.45;
	/** Points at which each strip's motion is sampled into keyframes. */
	const SAMPLES = 30;
	/** Darkest the paper gets when a strip stands edge-on to the light. */
	const MAX_SHADE = 0.42;

	/** Slice of the front face a strip shows, counted from the page's left. */
	const frontSlice = (index: number) => (direction === 'next' ? index : STRIPS - 1 - index);
	/** The back is seen from the other side, so its slices run the other way. */
	const backSlice = (index: number) => STRIPS - 1 - frontSlice(index);

	const easeInOut = (q: number) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
	/** How far strip `index` has turned (0–180°) at `progress` of the turn. */
	function turned(index: number, progress: number): number {
		const fromSpine = index / (STRIPS - 1);
		const local = progress * (1 + LEAD) - LEAD * (1 - fromSpine);
		return 180 * easeInOut(Math.min(1, Math.max(0, local)));
	}
	/** The moment a strip stands edge-on and its faces change places. */
	const edgeOnAt = (index: number) => (0.5 + LEAD * (1 - index / (STRIPS - 1))) / (1 + LEAD);

	let stripNodes = $state<HTMLElement[]>([]);

	onMount(() => {
		const sign = direction === 'next' ? -1 : 1;
		const timing: KeyframeAnimationOptions = {
			duration: DURATION,
			fill: 'both',
			direction: reverse ? 'reverse' : 'normal'
		};
		const offsets = Array.from({ length: SAMPLES + 1 }, (_, sample) => sample / SAMPLES);

		const animations = stripNodes.flatMap((node, index) => {
			// Each strip rotates on top of the one it hangs from.
			const bend = (progress: number) =>
				turned(index, progress) - (index > 0 ? turned(index - 1, progress) : 0);
			const swap = edgeOnAt(index);
			const faces = (visibleFirst: boolean): Keyframe[] => [
				{ offset: 0, opacity: visibleFirst ? 1 : 0, easing: 'steps(1, end)' },
				{ offset: swap, opacity: visibleFirst ? 0 : 1 },
				{ offset: 1, opacity: visibleFirst ? 0 : 1 }
			];
			return [
				node.animate(
					offsets.map((offset) => ({
						offset,
						transform: `rotateY(${(sign * bend(offset)).toFixed(2)}deg)`
					})),
					timing
				),
				node.querySelector(':scope > .face--front')!.animate(faces(true), timing),
				node.querySelector(':scope > .face--back')!.animate(faces(false), timing),
				...[...node.querySelectorAll(':scope > .face > .shade')].map((shade) =>
					shade.animate(
						offsets.map((offset) => ({
							offset,
							opacity: MAX_SHADE * Math.sin((turned(index, offset) * Math.PI) / 180)
						})),
						timing
					)
				)
			];
		});

		let cancelled = false;
		Promise.all(animations.map((animation) => animation.finished))
			.then(() => {
				if (!cancelled) onEnd();
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			for (const animation of animations) animation.cancel();
		};
	});
</script>

{#snippet strip(index: number)}
	<div bind:this={stripNodes[index]} class="strip" class:strip--first={index === 0}>
		<div class="face face--front">
			<div
				class="slice"
				style:width={`${STRIPS * 100}%`}
				style:left={`${-frontSlice(index) * 100}%`}
			>
				<FaceView face={frontPage} side={frontSide} {sizes} />
			</div>
			<div class="shade"></div>
		</div>
		<div class="face face--back">
			{#if backPage}
				<div
					class="slice"
					style:width={`${STRIPS * 100}%`}
					style:left={`${-backSlice(index) * 100}%`}
				>
					<FaceView face={backPage} side={backSide} {sizes} />
				</div>
			{/if}
			<div class="shade"></div>
		</div>
		{#if index < STRIPS - 1}
			{@render strip(index + 1)}
		{/if}
	</div>
{/snippet}

<div
	class="leaf"
	class:leaf-next={direction === 'next'}
	class:leaf-prev={direction === 'prev'}
	style:--strip-w={`${100 / STRIPS}%`}
>
	{@render strip(0)}
</div>

<style>
	.leaf {
		position: absolute;
		inset: 0;
		z-index: 20;
		transform-style: preserve-3d;
		/* The leaf is decorative while turning; taps belong to the page beneath. */
		pointer-events: none;
	}

	/* A strip hangs from the far edge of the one before it, spine first. */
	.strip {
		position: absolute;
		top: 0;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
	}
	.strip--first {
		width: var(--strip-w);
	}
	.leaf-next .strip {
		left: 100%;
		transform-origin: left center;
	}
	.leaf-prev .strip {
		right: 100%;
		transform-origin: right center;
	}
	.leaf-next .strip--first {
		left: 0;
	}
	.leaf-prev .strip--first {
		right: 0;
	}

	/**
	 * The two faces change places by opacity, not by `backface-visibility`:
	 * Chromium culls the pre-rotated face even while it is the one turned
	 * toward you. Opacity also keeps the hidden face painted, so it never
	 * shows blank for a frame when its turn comes.
	 */
	.face {
		position: absolute;
		/* A hair wider than the strip, so no seam shows between neighbours. */
		inset: 0 -0.5px;
		overflow: hidden;
	}
	.face--back {
		/* Blank paper when the sheet has nothing printed on its reverse. */
		background: #f3ead6;
		opacity: 0;
		transform: rotateY(180deg);
	}

	/* The whole page, of which the face shows one strip's worth. */
	.slice {
		position: absolute;
		top: 0;
		height: 100%;
	}

	/* Paper darkens as it turns away from the light. */
	.shade {
		position: absolute;
		inset: 0;
		background: rgb(16, 9, 2);
		opacity: 0;
	}
</style>
