import type { Action } from 'svelte/action';

export type SwipeDirection = 'left' | 'right';

export interface SwipeOptions {
	/** Whether swipes are being listened for right now. */
	enabled: () => boolean;
	onSwipe: (direction: SwipeDirection) => void;
}

/** Shortest horizontal travel, in CSS px, that counts as a swipe. */
const MIN_DISTANCE = 48;
/** A swipe must travel this many times further across than along. */
const DOMINANCE = 1.5;

/**
 * Reports one-finger horizontal swipes on the node. The click that follows
 * a swipe is swallowed, so a drag never also counts as a tap.
 */
export const swipe: Action<HTMLElement, SwipeOptions> = (node, initial) => {
	let options = initial;
	let start: { id: number; x: number; y: number } | null = null;
	/** Pointers currently down; more than one is a pinch, never a swipe. */
	const pointers = new Set<number>();

	function onPointerDown(event: PointerEvent) {
		// A primary pointer starts a new gesture, whatever was missed before.
		if (event.isPrimary) pointers.clear();
		pointers.add(event.pointerId);
		start =
			pointers.size === 1 && options.enabled()
				? { id: event.pointerId, x: event.clientX, y: event.clientY }
				: null;
	}

	function onPointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (!start || start.id !== event.pointerId) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		start = null;
		if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

		const swallow = (click: MouseEvent) => click.stopPropagation();
		node.addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(() => node.removeEventListener('click', swallow, { capture: true }));

		options.onSwipe(dx < 0 ? 'left' : 'right');
	}

	function onPointerCancel(event: PointerEvent) {
		pointers.delete(event.pointerId);
		start = null;
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);

	return {
		update(next) {
			options = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
		}
	};
};
