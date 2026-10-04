import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { bookStore } from './bookStore.svelte';

describe('BookStore 3D & Navigation Lifecycle', () => {
	it('initializes with total pages and navigation controls', () => {
		bookStore.setTotalPages(12);
		expect(bookStore.totalPages).toBe(12);
		expect(bookStore.currentPageIndex).toBe(0);
	});

	it('manages 3D book open/close lifecycle states', () => {
		expect(typeof bookStore.bookUIState).toBe('string');
		expect(typeof bookStore.isBookOpen).toBe('boolean');

		// Toggle audio
		const initialAudio = bookStore.audioEnabled;
		bookStore.toggleAudio();
		expect(bookStore.audioEnabled).toBe(!initialAudio);
		bookStore.toggleAudio();
		expect(bookStore.audioEnabled).toBe(initialAudio);
	});

	it('handles page navigation boundaries', () => {
		bookStore.setTotalPages(12);
		expect(bookStore.totalPages).toBe(12);

		// Cannot go prev on page 0
		expect(bookStore.canGoPrev).toBe(false);
	});

	describe('3D sheet turn animation', () => {
		const realRaf = globalThis.requestAnimationFrame;
		const realCaf = globalThis.cancelAnimationFrame;
		let rafId = 0;
		const pending = new Map<number, FrameRequestCallback>();

		beforeEach(() => {
			pending.clear();
			globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
				rafId += 1;
				pending.set(rafId, cb);
				return rafId;
			}) as typeof requestAnimationFrame;
			globalThis.cancelAnimationFrame = ((id: number) => {
				pending.delete(id);
			}) as typeof cancelAnimationFrame;
			bookStore.setTotalPages(12);
			bookStore.currentPageIndex = 0;
			bookStore.flipProgress = 0;
			bookStore.isFlipping = false;
			bookStore.flipTargetIndex = null;
			bookStore.isBookOpen = true;
		});

		afterEach(() => {
			globalThis.requestAnimationFrame = realRaf;
			globalThis.cancelAnimationFrame = realCaf;
			if (realRaf === undefined) {
				// Node has no native rAF; remove the stub entirely.
				delete (globalThis as Record<string, unknown>).requestAnimationFrame;
				delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
			}
			bookStore.currentPageIndex = 0;
			bookStore.flipProgress = 0;
			bookStore.isFlipping = false;
			bookStore.flipTargetIndex = null;
			bookStore.isBookOpen = false;
		});

		function runFrame(at: number) {
			const next = [...pending.entries()].sort((a, b) => a[0] - b[0])[0];
			expect(next, 'expected a scheduled animation frame').toBeDefined();
			pending.delete(next[0]);
			next[1](at);
		}

		it('seeds the sweep synchronously, before the first frame is drawn', () => {
			// Regression: the render loop's animation frame is queued ahead of
			// this store's, so a turn started while `flipProgress` still held
			// the previous turn's end value drew one frame at that stale
			// value -- the sheet jumped to its landing pose and flashed its
			// back for a frame.
			bookStore.currentPageIndex = 2;
			bookStore.flipProgress = 1;
			bookStore.nextPage();
			expect(bookStore.flipProgress).toBe(0);

			// Same again the other way, from the other stale end value.
			bookStore.isFlipping = false;
			bookStore.flipTargetIndex = null;
			bookStore.flipProgress = 0;
			bookStore.prevPage();
			expect(bookStore.flipProgress).toBe(1);
		});

		it('sweeps the sheet 0 -> 1 while turning to the next page', () => {
			bookStore.nextPage();
			expect(bookStore.isFlipping).toBe(true);

			const started = performance.now();
			runFrame(started);
			expect(bookStore.flipProgress).toBeCloseTo(0, 2);

			runFrame(started + 410);
			expect(bookStore.flipProgress).toBeGreaterThan(0.2);
			expect(bookStore.flipProgress).toBeLessThan(0.8);
			expect(bookStore.isFlipping).toBe(true);

			runFrame(started + 1000);
			expect(bookStore.flipProgress).toBe(1);
			expect(bookStore.currentPageIndex).toBe(1);
			expect(bookStore.isFlipping).toBe(false);
			expect(bookStore.flipTargetIndex).toBe(null);
		});

		it('sweeps the sheet 1 -> 0 while turning back to the previous page', () => {
			bookStore.currentPageIndex = 1;
			bookStore.prevPage();
			expect(bookStore.isFlipping).toBe(true);

			const started = performance.now();
			runFrame(started);
			expect(bookStore.flipProgress).toBeCloseTo(1, 2);

			// The old math held the sheet at 1 for the whole turn, so the
			// backward flip was invisible. It must travel back through the air.
			runFrame(started + 410);
			expect(bookStore.flipProgress).toBeGreaterThan(0.2);
			expect(bookStore.flipProgress).toBeLessThan(0.8);

			runFrame(started + 1000);
			expect(bookStore.flipProgress).toBe(0);
			expect(bookStore.currentPageIndex).toBe(0);
			expect(bookStore.isFlipping).toBe(false);
			expect(bookStore.flipTargetIndex).toBe(null);
		});
	});
});
