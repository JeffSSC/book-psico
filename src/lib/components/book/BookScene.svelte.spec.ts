import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BookScene from './BookScene.svelte';
import { bookPages } from '../../data/bookPages';
import { bookStore } from '../../stores/bookStore.svelte';

/**
 * End-to-end DOM smoke test of the 2D book: cover → open →
 * spread turn → single-mode slide. The store is a singleton, so
 * every test resets it and waits for the mount-time registration
 * before driving it directly.
 */

const OPEN_LABEL = 'Clique para abrir o livro';

function resetStore() {
	bookStore.spreadIndex = 0;
	bookStore.side = 'left';
	bookStore.mode = 'spread';
	bookStore.bookUIState = 'closed';
	bookStore.isFlipping = false;
	bookStore.pending = null;
}

async function mountOpened(mode: 'spread' | 'single') {
	resetStore();
	render(BookScene, { pages: bookPages });
	// Wait for mount-time page registration before touching the store.
	await vi.waitFor(() => {
		expect(bookStore.totalPages).toBe(12);
	});
	bookStore.bookUIState = 'opened';
	// Let the mount-time ResizeObserver measurement run — it would
	// otherwise override the mode under test — then force the mode.
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	bookStore.mode = mode;
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe('BookScene.svelte', () => {
	it('opens the book from the closed cover', async () => {
		resetStore();
		render(BookScene, { pages: bookPages });
		await vi.waitFor(() => {
			expect(bookStore.totalPages).toBe(12);
		});

		const cover = page.getByRole('button', { name: OPEN_LABEL });
		await expect.element(cover).toBeInTheDocument();

		await cover.click();
		await vi.waitFor(
			() => {
				expect(bookStore.bookUIState).toBe('opened');
			},
			{ timeout: 2000 }
		);

		// First spread, left page (01): the title page. Visible in
		// both view modes since the book opens on the left page.
		await expect
			.element(
				page.getByText('Um ensaio psicológico sobre mente, egocentrismo e liberdade interior')
			)
			.toBeInTheDocument();
	});

	it('turns a spread forward and back with the leaf animation', async () => {
		await mountOpened('spread');

		// Spread 1: P1 + P2.
		await expect.element(page.getByText('O Palco Invisível', { exact: true })).toBeInTheDocument();

		// Forward turn: the leaf carries P2 onto P1 and reveals P3 + P4.
		bookStore.next();
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.spreadIndex).toBe(1);
			},
			{ timeout: 2000 }
		);
		await expect.element(page.getByText('Índice Geral')).toBeInTheDocument();
		await expect.element(page.getByText('A Travessia das Mutações')).toBeInTheDocument();

		// Backward turn: the leaf carries P3 back onto P2. It swings
		// ACROSS the right page, so that page keeps showing the spread
		// we are leaving until the leaf has covered it.
		bookStore.prev();
		await expect.element(page.getByText('A Travessia das Mutações')).toBeInTheDocument();
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.spreadIndex).toBe(0);
			},
			{ timeout: 2000 }
		);
		await expect.element(page.getByText('O Palco Invisível', { exact: true })).toBeInTheDocument();
	});

	it('slides for every step, never leafing', async () => {
		await mountOpened('single');

		// Single mode starts on P1 (left page of spread 1); its
		// footer note is unique to the title page.
		await expect
			.element(
				page.getByText('Um ensaio psicológico sobre mente, egocentrismo e liberdade interior')
			)
			.toBeInTheDocument();

		// Next slides to P2 (right page of the same spread) — a slide,
		// with no leaf in the DOM at any point.
		bookStore.next();
		expect(document.querySelector('.slide-track')).not.toBeNull();
		expect(document.querySelectorAll('.leaf').length).toBe(0);
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.side).toBe('right');
			},
			{ timeout: 2000 }
		);
		await expect.element(page.getByText('O Palco Invisível', { exact: true })).toBeInTheDocument();

		// Next again slides across the spread boundary to P3.
		bookStore.next();
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.spreadIndex).toBe(1);
				expect(bookStore.side).toBe('left');
			},
			{ timeout: 2000 }
		);
		await expect.element(page.getByText('Índice Geral')).toBeInTheDocument();

		// Back is the exact inverse: slide to P2, then to P1.
		bookStore.prev();
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.spreadIndex).toBe(0);
				expect(bookStore.side).toBe('right');
			},
			{ timeout: 2000 }
		);
		bookStore.prev();
		await vi.waitFor(
			() => {
				expect(bookStore.isFlipping).toBe(false);
				expect(bookStore.side).toBe('left');
			},
			{ timeout: 2000 }
		);
		await expect
			.element(
				page.getByText('Um ensaio psicológico sobre mente, egocentrismo e liberdade interior')
			)
			.toBeInTheDocument();
	});
});
