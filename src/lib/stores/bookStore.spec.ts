import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookStore } from './bookStore.svelte';

/**
 * The store owns the 2D position model: a spread plus a mobile side.
 * Transitions are pending until the scene commits them (CSS-driven), so the
 * tests assert the pending/commit split rather than any per-frame progress.
 */

const PAGES = Array.from({ length: 12 }, (_, i) => ({
	id: `page-${String(i + 1).padStart(2, '0')}`
}));

function makeStore() {
	const store = new BookStore();
	store.registerPages(PAGES);
	return store;
}

function open(store: BookStore) {
	store.bookUIState = 'opened';
}

describe('BookStore position model', () => {
	let store: BookStore;

	beforeEach(() => {
		store = makeStore();
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (globalThis as Record<string, unknown>).window;
		delete (globalThis as Record<string, unknown>).localStorage;
	});

	it('derives the spread count from the page list', () => {
		expect(store.totalPages).toBe(12);
		expect(store.totalSpreads).toBe(6);
	});

	it('clamps the spread index when the book shrinks', () => {
		store.spreadIndex = 5;
		store.registerPages(PAGES.slice(0, 4));
		expect(store.spreadIndex).toBe(1);
	});

	describe('spread mode', () => {
		beforeEach(() => {
			store.mode = 'spread';
			open(store);
		});

		it('cannot go back on the first spread', () => {
			expect(store.canGoPrev).toBe(false);
			store.prev();
			expect(store.pending).toBeNull();
			expect(store.isFlipping).toBe(false);
		});

		it('next() pends the whole spread and commits on completeTransition()', () => {
			expect(store.canGoNext).toBe(true);
			store.next();
			expect(store.isFlipping).toBe(true);
			expect(store.flipDirection).toBe('next');
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'left' });
			// The committed position stays put until the animation ends.
			expect(store.spreadIndex).toBe(0);

			store.completeTransition();
			expect(store.spreadIndex).toBe(1);
			expect(store.side).toBe('left');
			expect(store.pending).toBeNull();
			expect(store.isFlipping).toBe(false);
		});

		it('prev() lands on the previous spread with the right side pending', () => {
			store.spreadIndex = 2;
			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'right' });
			store.completeTransition();
			expect(store.spreadIndex).toBe(1);
			expect(store.side).toBe('right');
		});

		it('cannot go past the last spread', () => {
			store.spreadIndex = 5;
			expect(store.canGoNext).toBe(false);
			store.next();
			expect(store.pending).toBeNull();
		});

		it('completeTransition() without a pending target is a no-op', () => {
			store.spreadIndex = 2;
			store.completeTransition();
			expect(store.spreadIndex).toBe(2);
			expect(store.isFlipping).toBe(false);
		});
	});

	describe('single mode', () => {
		beforeEach(() => {
			store.mode = 'single';
			open(store);
		});

		it('next() first slides to the right page of the spread', () => {
			store.spreadIndex = 0;
			store.side = 'left';
			store.next();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'right' });
			store.completeTransition();
			expect(store.spreadIndex).toBe(0);
			expect(store.side).toBe('right');
		});

		it('next() then leafs to the next spread, left side', () => {
			store.spreadIndex = 0;
			store.side = 'right';
			store.next();
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'left' });
			store.completeTransition();
			expect(store.spreadIndex).toBe(1);
			expect(store.side).toBe('left');
		});

		it('prev() is the exact inverse of next()', () => {
			store.spreadIndex = 1;
			store.side = 'left';
			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'right' });
			store.completeTransition();
			expect(store.spreadIndex).toBe(0);
			expect(store.side).toBe('right');

			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'left' });
			store.completeTransition();
			expect(store.side).toBe('left');
		});

		it('cannot step back past the first page', () => {
			store.spreadIndex = 0;
			store.side = 'left';
			expect(store.canGoPrev).toBe(false);
		});

		it('cannot step past the last page', () => {
			store.spreadIndex = 5;
			store.side = 'right';
			expect(store.canGoNext).toBe(false);
			store.next();
			expect(store.pending).toBeNull();
		});
	});

	describe('goToPage', () => {
		beforeEach(() => {
			open(store);
		});

		it('jumps to the spread containing the page (spread mode)', () => {
			store.mode = 'spread';
			store.goToPage(8); // page 9 -> spread 4
			expect(store.pending).toEqual({ spreadIndex: 4, side: 'left' });
			store.completeTransition();
			expect(store.spreadIndex).toBe(4);
		});

		it('lands on the requested side in single mode', () => {
			store.mode = 'single';
			store.spreadIndex = 0;
			store.side = 'left';
			store.goToPage(9); // page 10 -> spread 4, right side
			expect(store.pending).toEqual({ spreadIndex: 4, side: 'right' });
			store.completeTransition();
			expect(store.side).toBe('right');
		});

		it('is a no-op when the target is already visible in spread mode', () => {
			store.mode = 'spread';
			store.spreadIndex = 2;
			store.goToPage(4); // page 5, left of spread 2
			expect(store.pending).toBeNull();
			expect(store.isFlipping).toBe(false);
		});

		it('is ignored while a transition is in flight', () => {
			store.mode = 'single';
			store.spreadIndex = 0;
			store.side = 'left';
			store.next();
			store.goToPage(10);
			// The in-flight target is untouched.
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'right' });
		});

		it('is ignored while the book is closed', () => {
			store.mode = 'spread';
			store.bookUIState = 'closed';
			store.goToPage(4);
			expect(store.pending).toBeNull();
		});

		it('ignores out-of-bounds indexes', () => {
			store.mode = 'spread';
			store.goToPage(12);
			store.goToPage(-1);
			expect(store.pending).toBeNull();
		});
	});

	describe('progress', () => {
		it('tracks the page in single mode', () => {
			store.mode = 'single';
			store.spreadIndex = 0;
			store.side = 'left';
			expect(store.progressPercent).toBe(0);
			store.spreadIndex = 5;
			store.side = 'right';
			expect(store.progressPercent).toBe(100);
			store.spreadIndex = 2;
			store.side = 'left';
			expect(store.progressPercent).toBe(Math.round((4 / 11) * 100));
		});

		it('tracks the spread in spread mode', () => {
			store.mode = 'spread';
			store.spreadIndex = 0;
			expect(store.progressPercent).toBe(0);
			store.spreadIndex = 5;
			expect(store.progressPercent).toBe(100);
		});
	});

	describe('view mode', () => {
		it('switches in every state except mid-flip', () => {
			store.mode = 'spread';
			expect(store.mode).toBe('spread');

			// Allowed while closed (the framing is chosen before opening).
			store.bookUIState = 'closed';
			store.setMode('single');
			expect(store.mode).toBe('single');

			// Allowed while the cover opens/closes.
			store.bookUIState = 'opening';
			store.setMode('spread');
			expect(store.mode).toBe('spread');

			open(store);
			store.setMode('single');
			expect(store.mode).toBe('single');

			// Mid-flip: ignored, so the in-flight animation keeps its framing.
			store.next();
			store.setMode('spread');
			expect(store.mode).toBe('single');
			store.completeTransition();
		});
	});

	describe('open/close lifecycle', () => {
		it('opens and closes through the cover states', () => {
			vi.useFakeTimers();
			expect(store.bookUIState).toBe('closed');

			store.openBook();
			expect(store.bookUIState).toBe('opening');
			expect(store.isBookOpen).toBe(false);

			vi.advanceTimersByTime(850);
			expect(store.bookUIState).toBe('opened');
			expect(store.isBookOpen).toBe(true);

			store.closeBook();
			expect(store.bookUIState).toBe('closing');
			vi.advanceTimersByTime(850);
			expect(store.bookUIState).toBe('closed');
		});

		it('does not reopen while opening', () => {
			store.openBook();
			store.openBook();
			expect(store.bookUIState).toBe('opening');
		});

		it('does not close a closed book', () => {
			store.closeBook();
			expect(store.bookUIState).toBe('closed');
		});
	});

	describe('interactive answers', () => {
		it('records answers by page id', () => {
			store.selectOptionForPage('page-01', 'option-a');
			expect(store.selectedOptions['page-01']).toBe('option-a');
		});

		it('ignores unknown page ids', () => {
			store.selectOptionForPage('nope', 'option-a');
			expect(store.selectedOptions['nope']).toBeUndefined();
		});
	});

	describe('persistence', () => {
		function installStorage(initial: Record<string, string> = {}) {
			const backing = new Map(Object.entries(initial));
			const localStorageStub = {
				getItem: (key: string) => (backing.has(key) ? (backing.get(key) ?? null) : null),
				setItem: (key: string, value: string) => {
					backing.set(key, value);
				},
				removeItem: (key: string) => {
					backing.delete(key);
				}
			};
			Object.defineProperty(globalThis, 'localStorage', {
				value: localStorageStub,
				configurable: true
			});
			Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
			return backing;
		}

		it('restores the saved position', () => {
			installStorage({
				[`${'plateia_position'}`]: JSON.stringify({ spread: 2, side: 'right' })
			});
			const restored = new BookStore();
			expect(restored.spreadIndex).toBe(2);
			expect(restored.side).toBe('right');
		});

		it('migrates the legacy single-page position', () => {
			installStorage({ plateia_page_index: '7' });
			const migrated = new BookStore();
			expect(migrated.spreadIndex).toBe(3);
			expect(migrated.side).toBe('right');
		});

		it('ignores a malformed saved position', () => {
			installStorage({ plateia_position: 'not json' });
			const store = new BookStore();
			expect(store.spreadIndex).toBe(0);
			expect(store.side).toBe('left');
		});

		it('persists the position when a transition completes', () => {
			const backing = installStorage();
			const store = makeStore();
			store.bookUIState = 'opened';
			store.spreadIndex = 1;
			store.next();
			store.completeTransition();
			expect(backing.get('plateia_position')).toBe(JSON.stringify({ spread: 2, side: 'left' }));
		});
	});
});
