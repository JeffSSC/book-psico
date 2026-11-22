import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BookScene from './BookScene.svelte';
// The scene's layering relies on the app stylesheet, as in the real page.
import '../../../routes/layout.css';
import { comic } from '../../data/comic';
import { bookStore } from '../../stores/bookStore.svelte';

/**
 * End-to-end DOM test of the bare HQ reader: a book whose cover, pages and
 * back cover turn when clicked. The store is a singleton, so every test
 * resets it and waits for the mount-time registration before driving it.
 */

const OPEN_LABEL = 'Abrir a HQ';
/** Sides of the book: an empty one, the cover, 14 pages, the back cover, an empty one. */
const SIDES = 18;
const FIRST_SPREAD = 1;
const LAST_SPREAD = 7;
const BACK_COVER_SPREAD = 8;

const nextFrames = () =>
	new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** Mounts the reader resting at a position; the cover by default. */
async function mountAt(
	mode: 'spread' | 'single',
	spreadIndex = 0,
	side: 'left' | 'right' = spreadIndex === 0 ? 'right' : 'left'
) {
	bookStore.isFlipping = false;
	bookStore.pending = null;
	localStorage.clear();
	// The reader picks its framing from the screen, so give it the right one.
	await (mode === 'single' ? page.viewport(390, 844) : page.viewport(1280, 800));
	render(BookScene, { comic });
	// Wait for mount-time registration before touching the store.
	await vi.waitFor(() => {
		expect(bookStore.totalPages).toBe(SIDES);
	});
	// Let the mount-time measurement run — it would otherwise override
	// the mode under test — then force the mode and the position.
	await nextFrames();
	bookStore.mode = mode;
	bookStore.spreadIndex = spreadIndex;
	bookStore.side = side;
	await nextFrames();
}

async function settled(expected: { spreadIndex: number; side?: 'left' | 'right' }) {
	await vi.waitFor(
		() => {
			expect(bookStore.isFlipping).toBe(false);
			expect(bookStore.spreadIndex).toBe(expected.spreadIndex);
			if (expected.side) expect(bookStore.side).toBe(expected.side);
		},
		{ timeout: 2000 }
	);
}

/** Alt text of the art resting on screen, left to right. */
const shownPages = () =>
	[...document.querySelectorAll<HTMLImageElement>('.book img')].map((img) => img.alt);
/** The two story pages of a spread, as `shownPages` reports them. */
const spreadPages = (spreadIndex: number) => [
	comic.pages[spreadIndex * 2 - 2].alt,
	comic.pages[spreadIndex * 2 - 1].alt
];

const coverArea = () => page.getByRole('button', { name: OPEN_LABEL });
const previousArea = () => page.getByRole('button', { name: 'Página anterior' });
const nextArea = () => page.getByRole('button', { name: 'Próxima página' });
const backCover = () => page.getByRole('img', { name: 'Contracapa' });
const stage = () => document.querySelector<HTMLElement>('.scene')!;
/** Names of the buttons a reader can reach (inert ones are not there for them). */
const buttonNames = () =>
	[...document.querySelectorAll('button:not([inert])')]
		.map((button) => button.getAttribute('aria-label'))
		.sort();

/** Horizontal distance, in px, between an element's centre and the stage's. */
function offCentre(element: Element): number {
	const rect = element.getBoundingClientRect();
	const whole = stage().getBoundingClientRect();
	return Math.abs(rect.left + rect.width / 2 - (whole.left + whole.width / 2));
}

/** Relative luminance (0 black – 1 white) of a CSS `rgb()` colour. */
function luminance(color: string): number {
	const [r, g, b] = color.match(/[\d.]+/g)!.map((channel) => {
		const c = Number(channel) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pointer(type: string, point: { x: number; y: number }, pointerId = 1) {
	stage().dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			pointerId,
			pointerType: 'touch',
			isPrimary: pointerId === 1,
			clientX: point.x,
			clientY: point.y
		})
	);
}

/** Drags one pointer across the stage, as a finger would. */
function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
	pointer('pointerdown', from);
	pointer('pointermove', to);
	pointer('pointerup', to);
}

describe('BookScene.svelte', () => {
	it('the closed book shows only its cover', async () => {
		await mountAt('spread');

		expect(shownPages()).toEqual([comic.cover.alt]);
		expect(buttonNames()).toEqual([OPEN_LABEL]);
		expect(document.querySelector('h1, h2, h3')).toBeNull();
		expect(stage().textContent!.trim()).toBe('');

		const art = document.querySelector<HTMLImageElement>('.book img')!;
		expect(art.getAttribute('loading')).toBe('eager');
		expect(art.getAttribute('fetchpriority')).toBe('high');
		await vi.waitFor(() => {
			expect(offCentre(art)).toBeLessThanOrEqual(2);
		});
	});

	it('the cover opens like a page', async () => {
		await mountAt('spread');

		await coverArea().click();
		// The cover itself is the leaf that turns.
		const leafFront = document.querySelector<HTMLImageElement>('.leaf .face--front img');
		expect(leafFront?.alt).toBe(comic.cover.alt);

		await settled({ spreadIndex: FIRST_SPREAD });
		expect(shownPages()).toEqual(spreadPages(FIRST_SPREAD));
		await vi.waitFor(() => {
			expect(offCentre(document.querySelector('.spread-frame')!)).toBeLessThanOrEqual(2);
		});
	});

	it('the open book shows only its pages', async () => {
		await mountAt('spread', FIRST_SPREAD);

		expect(buttonNames()).toEqual(['Página anterior', 'Próxima página'].sort());
		expect(document.querySelector('h1, h2, h3, header, footer, dialog')).toBeNull();
		expect(document.querySelector('[role="progressbar"]')).toBeNull();
		// No title, Sumário, counter or hint: the art is the only content.
		expect(stage().textContent!.trim()).toBe('');
		expect(shownPages()).toEqual(spreadPages(FIRST_SPREAD));
	});

	it('clicking the right page goes forward and the left page goes back', async () => {
		await mountAt('spread', FIRST_SPREAD);

		// Each click area is exactly one page of the spread.
		const left = document.querySelector('.half--left')!.getBoundingClientRect();
		const right = document.querySelector('.half--right')!.getBoundingClientRect();
		const back = previousArea().element().getBoundingClientRect();
		const forward = nextArea().element().getBoundingClientRect();
		for (const [area, half] of [
			[back, left],
			[forward, right]
		] as const) {
			expect(area.left).toBeCloseTo(half.left, 0);
			expect(area.right).toBeCloseTo(half.right, 0);
			expect(area.top).toBeCloseTo(half.top, 0);
			expect(area.bottom).toBeCloseTo(half.bottom, 0);
		}

		await nextArea().click();
		await settled({ spreadIndex: 2 });
		expect(shownPages()).toEqual(spreadPages(2));

		await previousArea().click();
		await settled({ spreadIndex: FIRST_SPREAD });
		expect(shownPages()).toEqual(spreadPages(FIRST_SPREAD));
	});

	it('going back from the first spread closes the book on its cover', async () => {
		await mountAt('spread', FIRST_SPREAD);

		await previousArea().click();
		expect(document.querySelector('.leaf')).not.toBeNull();
		await settled({ spreadIndex: 0 });

		expect(shownPages()).toEqual([comic.cover.alt]);
		await vi.waitFor(() => {
			expect(offCentre(document.querySelector('.book img')!)).toBeLessThanOrEqual(2);
		});
	});

	it('after the last spread comes the back cover', async () => {
		await mountAt('spread', LAST_SPREAD);
		expect(shownPages()).toEqual(spreadPages(LAST_SPREAD));

		await nextArea().click();
		await settled({ spreadIndex: BACK_COVER_SPREAD });
		expect(shownPages()).toEqual([]);
		await expect.element(backCover()).toBeVisible();
		await vi.waitFor(() => {
			expect(offCentre(backCover().element())).toBeLessThanOrEqual(2);
		});

		// The back cover is the left page: clicking it goes back.
		expect(buttonNames()).toEqual(['Página anterior']);
		await previousArea().click();
		await settled({ spreadIndex: LAST_SPREAD });

		await nextArea().click();
		await settled({ spreadIndex: BACK_COVER_SPREAD });
		await userEvent.keyboard('{ArrowRight}');
		await settled({ spreadIndex: 0 });
		expect(shownPages()).toEqual([comic.cover.alt]);
	});

	it("the back cover is drawn in the cover's colours", async () => {
		await mountAt('spread', BACK_COVER_SPREAD);

		const board = backCover().element();
		expect(luminance(getComputedStyle(board).backgroundColor)).toBeLessThanOrEqual(0.1);
		expect(board.textContent!.trim()).toBe('');

		const half = document.querySelector('.half--left')!.getBoundingClientRect();
		const rect = board.getBoundingClientRect();
		expect(rect.width).toBeCloseTo(half.width, 0);
		expect(rect.height).toBeCloseTo(half.height, 0);
	});

	it('arrow keys turn the page and Escape returns to the cover', async () => {
		await mountAt('spread');

		await userEvent.keyboard('{ArrowRight}');
		await settled({ spreadIndex: FIRST_SPREAD });
		await userEvent.keyboard('{ArrowRight}');
		await settled({ spreadIndex: 2 });
		await userEvent.keyboard('{ArrowLeft}');
		await settled({ spreadIndex: FIRST_SPREAD });

		await userEvent.keyboard('{ArrowRight}');
		await settled({ spreadIndex: 2 });
		await userEvent.keyboard('{Escape}');
		await settled({ spreadIndex: 0 });
		expect(shownPages()).toEqual([comic.cover.alt]);
	});

	it('keyboard focus stays on the forward area', async () => {
		await mountAt('spread');

		// Forward is the first stop, so Enter never turns a fresh reader back.
		await userEvent.keyboard('{Tab}');
		const forward = document.activeElement!;
		expect(forward.getAttribute('aria-label')).toBe(OPEN_LABEL);

		await userEvent.keyboard('{Enter}');
		await settled({ spreadIndex: FIRST_SPREAD });
		expect(document.activeElement).toBe(forward);
		expect(forward.getAttribute('aria-label')).toBe('Próxima página');

		await userEvent.keyboard('{Enter}');
		await settled({ spreadIndex: 2 });
		expect(document.activeElement).toBe(forward);
	});

	it('keyboard focus moves to the other area when its own goes away', async () => {
		// Forward disappears on the back cover: focus passes to the back area.
		await mountAt('spread', LAST_SPREAD);
		nextArea().element().focus();
		await userEvent.keyboard('{Enter}');
		await settled({ spreadIndex: BACK_COVER_SPREAD });
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Página anterior');

		// Back disappears on the cover: focus passes to the forward area.
		bookStore.spreadIndex = FIRST_SPREAD;
		await nextFrames();
		previousArea().element().focus();
		await userEvent.keyboard('{Enter}');
		await settled({ spreadIndex: 0 });
		expect(document.activeElement?.getAttribute('aria-label')).toBe(OPEN_LABEL);
	});

	it('a returning reader finds the book open where they stopped', async () => {
		localStorage.setItem('parque_position', JSON.stringify({ spread: 3, side: 'left' }));
		bookStore.isFlipping = false;
		bookStore.pending = null;
		bookStore.spreadIndex = 0;
		bookStore.side = 'right';
		await page.viewport(1280, 800);
		render(BookScene, { comic });

		await vi.waitFor(() => {
			expect(bookStore.spreadIndex).toBe(3);
		});
		await nextFrames();
		expect(shownPages()).toEqual(spreadPages(3));

		// Each image is the art its alt text names, not what was drawn before.
		const images = [...document.querySelectorAll<HTMLImageElement>('.book img')];
		await vi.waitFor(() => {
			expect(images.map((img) => /(\d\d)-\d+\./.exec(img.currentSrc)?.[1])).toEqual(['06', '07']);
		});
		localStorage.clear();
	});

	it('only mounts the pages on screen', async () => {
		await mountAt('spread', FIRST_SPREAD);
		expect(document.querySelectorAll('.book img').length).toBe(2);

		// Mid-turn the bending leaf draws its two faces in strips: four pages
		// are on screen at most, never the whole HQ.
		bookStore.next();
		await nextFrames();
		expect(new Set(shownPages()).size).toBeLessThanOrEqual(4);
		await settled({ spreadIndex: 2 });
		expect(document.querySelectorAll('.book img').length).toBe(2);
	});

	it('on a phone the right half goes forward and the left half goes back', async () => {
		await mountAt('single', FIRST_SPREAD);
		expect(shownPages()).toEqual([comic.pages[0].alt]);

		const frame = document.querySelector('.single-frame')!.getBoundingClientRect();
		const back = previousArea().element().getBoundingClientRect();
		const forward = nextArea().element().getBoundingClientRect();
		expect(back.left).toBeCloseTo(frame.left, 0);
		expect(back.right).toBeCloseTo(frame.left + frame.width / 2, 0);
		expect(forward.left).toBeCloseTo(frame.left + frame.width / 2, 0);
		expect(forward.right).toBeCloseTo(frame.right, 0);

		// Every step is a flip of the sheet, never a slide.
		await nextArea().click();
		expect(document.querySelector('.leaf')).not.toBeNull();
		expect(document.querySelector('.slide-track')).toBeNull();
		await settled({ spreadIndex: FIRST_SPREAD, side: 'right' });
		expect(shownPages()).toEqual([comic.pages[1].alt]);

		await nextArea().click();
		expect(document.querySelector('.leaf')).not.toBeNull();
		await settled({ spreadIndex: 2, side: 'left' });
		expect(shownPages()).toEqual([comic.pages[2].alt]);

		await previousArea().click();
		expect(document.querySelector('.leaf')).not.toBeNull();
		expect(document.querySelector('.slide-track')).toBeNull();
		await settled({ spreadIndex: FIRST_SPREAD, side: 'right' });
		expect(shownPages()).toEqual([comic.pages[1].alt]);
	});

	it('on a phone the cover and every page flip', async () => {
		await mountAt('single');
		expect(shownPages()).toEqual([comic.cover.alt]);
		expect(buttonNames()).toEqual([OPEN_LABEL]);

		await coverArea().click();
		const leafFront = document.querySelector<HTMLImageElement>('.leaf .face--front img');
		expect(leafFront?.alt).toBe(comic.cover.alt);
		expect(document.querySelector('.slide-track')).toBeNull();

		await settled({ spreadIndex: FIRST_SPREAD, side: 'left' });
		expect(shownPages()).toEqual([comic.pages[0].alt]);
		expect(document.querySelector('.leaf')).toBeNull();
	});

	it('clicking outside the pages does nothing', async () => {
		await mountAt('single', FIRST_SPREAD);
		const area = stage().getBoundingClientRect();

		await userEvent.click(stage(), { position: { x: 4, y: area.height / 2 } });
		await userEvent.click(stage(), { position: { x: area.width - 4, y: area.height / 2 } });
		await nextFrames();

		expect(bookStore.isFlipping).toBe(false);
		expect(bookStore.pageIndexOfSide).toBe(2);
	});

	it('a horizontal swipe turns the page on a phone', async () => {
		await mountAt('single', FIRST_SPREAD);

		drag({ x: 300, y: 400 }, { x: 240, y: 406 });
		await settled({ spreadIndex: FIRST_SPREAD, side: 'right' });

		drag({ x: 240, y: 400 }, { x: 300, y: 396 });
		await settled({ spreadIndex: FIRST_SPREAD, side: 'left' });

		// The click a browser sends after a drag must not turn a second page,
		// even when the first turn has already landed.
		drag({ x: 300, y: 400 }, { x: 240, y: 400 });
		bookStore.completeTransition();
		nextArea()
			.element()
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(bookStore.isFlipping).toBe(false);
		expect(bookStore.pageIndexOfSide).toBe(3);
		await nextFrames();

		// A vertical drag is a scroll gesture, not a page turn.
		drag({ x: 200, y: 300 }, { x: 210, y: 420 });
		await nextFrames();
		expect(bookStore.isFlipping).toBe(false);
		expect(bookStore.pageIndexOfSide).toBe(3);
	});

	it('a two-finger gesture never turns the page', async () => {
		await mountAt('single', FIRST_SPREAD);

		// Whichever finger travels sideways, a pinch is not a swipe.
		for (const moving of [1, 2]) {
			const still = moving === 1 ? 2 : 1;
			pointer('pointerdown', { x: 250, y: 400 }, 1);
			pointer('pointerdown', { x: 350, y: 420 }, 2);
			pointer('pointermove', { x: 150, y: 400 }, moving);
			pointer('pointerup', { x: 150, y: 400 }, moving);
			pointer('pointerup', { x: 300, y: 410 }, still);
			await nextFrames();

			expect(bookStore.isFlipping).toBe(false);
			expect(bookStore.pageIndexOfSide).toBe(2);
		}

		// One finger alone still swipes afterwards.
		drag({ x: 300, y: 400 }, { x: 220, y: 400 });
		await settled({ spreadIndex: FIRST_SPREAD, side: 'right' });
	});

	it('nothing enlarges a page', async () => {
		await mountAt('spread', FIRST_SPREAD);

		await nextArea().dblClick();
		await vi.waitFor(() => {
			expect(bookStore.isFlipping).toBe(false);
		});
		await previousArea().click();
		await vi.waitFor(() => {
			expect(bookStore.isFlipping).toBe(false);
		});

		expect(document.querySelector('dialog, [role="dialog"]')).toBeNull();
		expect(buttonNames().filter((name) => /ampliar/i.test(name ?? ''))).toEqual([]);
	});

	it('the pages use the whole screen', async () => {
		await mountAt('spread', FIRST_SPREAD);

		const spread = document.querySelector('.spread-frame')!.getBoundingClientRect();
		expect(spread.height / stage().getBoundingClientRect().height).toBeGreaterThanOrEqual(0.92);
	});

	it('the stage is bright', async () => {
		await mountAt('spread', FIRST_SPREAD);

		expect(luminance(getComputedStyle(stage()).backgroundColor)).toBeGreaterThanOrEqual(0.7);
		expect(document.querySelector('.fireflies')).toBeNull();
	});
});
