import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playPaperFlipSound } from '../audio/sfx';
import { BookStore } from './bookStore.svelte';

vi.mock('../audio/sfx', () => ({ playPaperFlipSound: vi.fn() }));

/**
 * The store owns the position model: a spread plus a side for the phone.
 * Transitions are pending until the scene commits them (CSS-driven), so the
 * tests assert the pending/commit split rather than any per-frame progress.
 */

const side = (i: number) => ({ id: `side-${String(i).padStart(2, '0')}` });

/** Twelve sides, all filled: six plain spreads. */
const PAGES = Array.from({ length: 12 }, (_, i) => side(i));

/**
 * A book as the reader lays it out: the cover alone on the right of the
 * first spread, four pages, the back cover alone on the left of the last.
 */
const BOOK = [null, side(1), side(2), side(3), side(4), side(5), side(6), null];
const COVER = { spreadIndex: 0, side: 'right' };
const BACK_COVER = { spreadIndex: 3, side: 'left' };

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

function makeStore(sides: ({ id: string } | null)[] = PAGES) {
	const store = new BookStore();
	store.registerPages(sides);
	return store;
}

const position = (store: BookStore) => ({ spreadIndex: store.spreadIndex, side: store.side });

describe('BookStore position model', () => {
	let store: BookStore;

	beforeEach(() => {
		store = makeStore();
		vi.mocked(playPaperFlipSound).mockClear();
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

	it('starts on the cover, not on the empty side beside it', () => {
		expect(position(makeStore(BOOK))).toEqual(COVER);
	});

	describe('spread mode', () => {
		beforeEach(() => {
			store.mode = 'spread';
		});

		it('next() pends the whole spread and commits on completeTransition()', () => {
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

		it('completeTransition() without a pending target is a no-op', () => {
			store.spreadIndex = 2;
			store.completeTransition();
			expect(store.spreadIndex).toBe(2);
			expect(store.isFlipping).toBe(false);
		});

		it('a step arriving mid-turn is ignored', () => {
			store.next();
			store.next();
			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'left' });
		});
	});

	describe('single mode', () => {
		beforeEach(() => {
			store.mode = 'single';
		});

		it('next() first turns to the right page of the spread', () => {
			store.spreadIndex = 0;
			store.side = 'left';
			store.next();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'right' });
			store.completeTransition();
			expect(store.side).toBe('right');
		});

		it('next() then turns to the next spread, left side', () => {
			store.spreadIndex = 0;
			store.side = 'right';
			store.next();
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'left' });
		});

		it('prev() is the exact inverse of next()', () => {
			store.spreadIndex = 1;
			store.side = 'left';
			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'right' });
			store.completeTransition();
			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 0, side: 'left' });
		});
	});

	describe('covers', () => {
		beforeEach(() => {
			store = makeStore(BOOK);
		});

		it('nothing lies before the cover', () => {
			for (const mode of ['spread', 'single'] as const) {
				store.mode = mode;
				expect(position(store)).toEqual(COVER);

				store.prev();
				expect(store.pending).toBeNull();
				expect(store.isFlipping).toBe(false);
				expect(position(store)).toEqual(COVER);
			}
		});

		it('going forward from the back cover returns to the front cover', () => {
			for (const mode of ['spread', 'single'] as const) {
				const store = makeStore(BOOK);
				store.mode = mode;
				store.spreadIndex = BACK_COVER.spreadIndex;
				store.side = 'left';

				store.next();
				expect(store.pending).toEqual(COVER);
				expect(store.flipDirection).toBe('prev');
				store.completeTransition();
				expect(position(store)).toEqual(COVER);
			}
		});

		it('a turn inside the book still only turns the page', () => {
			store.mode = 'spread';
			store.spreadIndex = 1;

			store.next();
			expect(store.pending).toEqual({ spreadIndex: 2, side: 'left' });
			store.completeTransition();

			store.prev();
			expect(store.pending).toEqual({ spreadIndex: 1, side: 'right' });
		});

		it('a phone walks every face once and skips the empty sides', () => {
			store.mode = 'single';
			const faces = BOOK.filter((entry) => entry !== null);
			const visited = [BOOK[store.pageIndexOfSide]];

			for (let step = 1; step < faces.length; step++) {
				store.next();
				expect(store.flipDirection).toBe('next');
				store.completeTransition();
				visited.push(BOOK[store.pageIndexOfSide]);
			}
			expect(visited).toEqual(faces);
			expect(position(store)).toEqual(BACK_COVER);

			for (let step = 1; step < faces.length; step++) {
				store.prev();
				store.completeTransition();
				visited.pop();
				expect(BOOK[store.pageIndexOfSide]).toBe(visited.at(-1));
			}
			expect(position(store)).toEqual(COVER);
		});

		it('an odd page count never rests on a missing last side', () => {
			const store = makeStore([null, side(1), side(2), side(3), side(4)]);
			store.mode = 'single';
			store.spreadIndex = 2;
			store.side = 'left';

			store.next();
			expect(store.pending).toEqual(COVER);
		});

		it('goToCover turns straight back to the cover', () => {
			store.mode = 'spread';
			store.goToCover();
			expect(store.pending).toBeNull();

			store.spreadIndex = 2;
			store.goToCover();
			expect(store.pending).toEqual(COVER);
			expect(store.flipDirection).toBe('prev');

			// Ignored mid-turn: the turn in flight keeps its target.
			store.completeTransition();
			store.spreadIndex = 1;
			store.next();
			store.goToCover();
			expect(store.pending).toEqual({ spreadIndex: 2, side: 'left' });
			expect(store.flipDirection).toBe('next');
		});

		it('switching to a phone never lands on an empty side', () => {
			store.mode = 'spread';
			store.spreadIndex = BACK_COVER.spreadIndex;
			store.side = 'right';

			store.setMode('single');
			expect(position(store)).toEqual(BACK_COVER);
		});
	});

	describe('sound', () => {
		it('every page turn plays the paper sound', () => {
			const store = makeStore(BOOK);

			// Turning the cover is a page turn like any other.
			store.mode = 'spread';
			store.next();
			expect(playPaperFlipSound).toHaveBeenLastCalledWith('next');
			store.completeTransition();

			store.mode = 'single';
			store.next();
			expect(playPaperFlipSound).toHaveBeenLastCalledWith('next');
			store.completeTransition();

			store.prev();
			expect(playPaperFlipSound).toHaveBeenLastCalledWith('prev');
			expect(playPaperFlipSound).toHaveBeenCalledTimes(3);
		});
	});

	describe('view mode', () => {
		it('switches whenever no turn is in flight', () => {
			store.mode = 'spread';
			store.setMode('single');
			expect(store.mode).toBe('single');

			// Mid-flip: ignored, so the in-flight animation keeps its framing.
			store.next();
			store.setMode('spread');
			expect(store.mode).toBe('single');
			store.completeTransition();

			store.setMode('spread');
			expect(store.mode).toBe('spread');
		});
	});

	describe('persistence', () => {
		it('persists the position under the comic key', () => {
			const backing = installStorage();
			const store = makeStore();
			store.spreadIndex = 1;
			store.next();
			store.completeTransition();
			expect(backing.get('parque_position')).toBe(JSON.stringify({ spread: 2, side: 'left' }));

			// A new store starts on the cover until it is told to restore.
			const restored = makeStore();
			expect(restored.spreadIndex).toBe(0);
			restored.restorePosition();
			expect(restored.spreadIndex).toBe(2);
			expect(restored.side).toBe('left');
		});

		it('ignores positions stored under other keys', () => {
			installStorage({
				plateia_position: JSON.stringify({ spread: 2, side: 'right' }),
				plateia_page_index: '7'
			});
			const store = makeStore();
			store.restorePosition();
			expect(store.spreadIndex).toBe(0);
			expect(store.side).toBe('left');
		});

		it('ignores a malformed saved position', () => {
			installStorage({ parque_position: 'not json' });
			const store = makeStore();
			store.restorePosition();
			expect(store.spreadIndex).toBe(0);
			expect(store.side).toBe('left');
		});

		it('a saved position on an empty side or past the end is brought back into the book', () => {
			installStorage({ parque_position: JSON.stringify({ spread: 0, side: 'left' }) });
			const onEmptySide = makeStore(BOOK);
			onEmptySide.restorePosition();
			expect(position(onEmptySide)).toEqual(COVER);

			installStorage({ parque_position: JSON.stringify({ spread: 40, side: 'right' }) });
			const pastTheEnd = makeStore(BOOK);
			pastTheEnd.restorePosition();
			expect(position(pastTheEnd)).toEqual(BACK_COVER);
		});
	});
});
