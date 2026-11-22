<script lang="ts">
	import { onMount } from 'svelte';
	import type { BookFace, FlipDirection, PageSide } from '../../types/book';
	import FaceView from './FaceView.svelte';

	/**
	 * The turning leaf, bending like paper. It fills its positioning parent
	 * (a spread half, or the single page of a phone) and hinges on the spine:
	 * "next" on its LEFT edge, "prev" on its RIGHT edge. The sheet is cut
	 * into vertical strips, each turning on the edge of the one before; the
	 * free edge lifts first and the curl travels to the spine, so the paper
	 * bends instead of swinging as a board. `reverse` plays a turn backwards: the
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

	const strips = Array.from({ length: STRIPS }, (_, index) => index);

	/**
	 * Where strip `index` is at `progress`: every strip from the spine out
	 * to it turns on its own hinge by the bend it adds to the one before.
	 * Strips are placed one by one, not nested, so the browser's rounding
	 * of each to whole pixels cannot add up across the page.
	 */
	function placement(index: number, progress: number): string {
		const sign = direction === 'next' ? -1 : 1;
		const steps: string[] = [];
		for (let hinge = 0; hinge <= index; hinge++) {
			const bend = turned(hinge, progress) - (hinge > 0 ? turned(hinge - 1, progress) : 0);
			// Distance from this strip's own hinge edge, in strip widths.
			const away = sign * (index - hinge) * 100;
			steps.push(
				`translateX(${away}%) rotateY(${(sign * bend).toFixed(2)}deg) translateX(${-away}%)`
			);
		}
		return steps.join(' ');
	}

	let stripNodes = $state<HTMLElement[]>([]);

	onMount(() => {
		const timing: KeyframeAnimationOptions = {
			duration: DURATION,
			fill: 'both',
			direction: reverse ? 'reverse' : 'normal'
		};
		const offsets = Array.from({ length: SAMPLES + 1 }, (_, sample) => sample / SAMPLES);

		const animations = stripNodes.flatMap((node, index) => {
			const swap = edgeOnAt(index);
			const faces = (visibleFirst: boolean): Keyframe[] => [
				{ offset: 0, opacity: visibleFirst ? 1 : 0, easing: 'steps(1, end)' },
				{ offset: swap, opacity: visibleFirst ? 0 : 1 },
				{ offset: 1, opacity: visibleFirst ? 0 : 1 }
			];
			return [
				node.animate(
					offsets.map((offset) => ({ offset, transform: placement(index, offset) })),
					timing
				),
				node.querySelector('.face--front')!.animate(faces(true), timing),
				node.querySelector('.face--back')!.animate(faces(false), timing),
				...[...node.querySelectorAll('.shade')].map((shade) =>
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

<div
	class="leaf"
	class:leaf-next={direction === 'next'}
	class:leaf-prev={direction === 'prev'}
	style:--strips={STRIPS}
>
	{#each strips as index (index)}
		<div bind:this={stripNodes[index]} class="strip" style:--from-spine={index}>
			<div class="face face--front">
				<div class="slice" style:--slice={frontSlice(index)}>
					<FaceView face={frontPage} side={frontSide} {sizes} />
				</div>
				<div class="shade"></div>
			</div>
			<div class="face face--back">
				{#if backPage}
					<div class="slice" style:--slice={backSlice(index)}>
						<FaceView face={backPage} side={backSide} {sizes} />
					</div>
				{/if}
				<div class="shade"></div>
			</div>
		</div>
	{/each}
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

	/* Strips stand side by side, counted from the spine. */
	.strip {
		--strip-w: calc(100% / var(--strips));
		position: absolute;
		top: 0;
		width: var(--strip-w);
		height: 100%;
		transform-style: preserve-3d;
	}
	.leaf-next .strip {
		left: calc(var(--from-spine) * var(--strip-w));
		transform-origin: left center;
	}
	.leaf-prev .strip {
		right: calc(var(--from-spine) * var(--strip-w));
		transform-origin: right center;
	}

	/**
	 * The two faces change places by opacity, not by `backface-visibility`:
	 * Chromium culls the pre-rotated face even while it is the one turned
	 * toward you. Opacity also keeps the hidden face painted, so it never
	 * shows blank for a frame when its turn comes.
	 */
	.face {
		--overlap: 1px;
		position: absolute;
		/* A hair wider than the strip, so no seam shows between neighbours. */
		inset: 0 calc(-1 * var(--overlap));
		overflow: hidden;
	}
	.face--back {
		/* Blank paper when the sheet has nothing printed on its reverse. */
		background: #f3ead6;
		opacity: 0;
		transform: rotateY(180deg);
	}

	/* The whole page at its true size, of which the face shows one strip's
	   worth; sized from the strip, which is the face less its overlap. */
	.slice {
		--strip: calc(100% - 2 * var(--overlap));
		position: absolute;
		top: 0;
		left: calc(var(--overlap) - var(--slice) * var(--strip));
		width: calc(var(--strips) * var(--strip));
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
