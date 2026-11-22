import { describe, expect, it } from 'vitest';
import { bookFaces, bookSides, comic, pageSources, pagesToPreload } from './comic';

describe('comic', () => {
	it('has one cover and 14 story pages in reading order', () => {
		expect(comic.cover.image).toBe(1);
		expect(comic.pages).toHaveLength(14);
		expect(comic.pages.map((page) => page.image)).toEqual([
			2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
		]);

		const ids = [comic.cover, ...comic.pages].map((page) => page.id);
		expect(new Set(ids).size).toBe(15);
	});

	it('every page has pt-BR alt text', () => {
		for (const page of [comic.cover, ...comic.pages]) {
			expect(page.alt.trim(), page.id).not.toBe('');
		}
		// Each story page says what is drawn on it, not only where it sits.
		for (const page of comic.pages) {
			expect(page.alt.length, page.id).toBeGreaterThan(page.title.length + 60);
		}
		expect(new Set(comic.pages.map((page) => page.alt)).size).toBe(comic.pages.length);
	});
});

describe('bookFaces', () => {
	it('the book is the cover, 14 pages and the back cover', () => {
		const faces = bookFaces(comic);
		expect(faces).toHaveLength(16);
		expect(faces[0]).toMatchObject({ kind: 'page', page: comic.cover });
		expect(faces.slice(1, 15).map((face) => (face.kind === 'page' ? face.page : null))).toEqual(
			comic.pages
		);
		expect(faces[15].kind).toBe('back');
		expect(new Set(faces.map((face) => face.id)).size).toBe(16);
	});

	it('the cover lies alone on the right and the back cover alone on the left', () => {
		const sides = bookSides(comic);
		const faces = bookFaces(comic);
		expect(sides).toHaveLength(18);
		// First spread: nothing, then the cover.
		expect(sides.slice(0, 2)).toEqual([null, faces[0]]);
		// Last spread: the back cover, then nothing.
		expect(sides.slice(-2)).toEqual([faces[15], null]);
		// Story pages 1 and 2 share the second spread.
		expect(sides.slice(2, 4)).toEqual([faces[1], faces[2]]);
	});
});

describe('pageSources', () => {
	it('builds one srcset per format', () => {
		const sources = pageSources(comic.pages[1]);

		expect(sources.avif).toMatch(/^\S+03-720\S*\.avif 720w, \S+03-1400\S*\.avif 1400w$/);
		expect(sources.webp).toMatch(/^\S+03-720\S*\.webp 720w, \S+03-1400\S*\.webp 1400w$/);
		expect(sources.src).toMatch(/03-720\S*\.webp$/);
		expect(sources.width).toBe(1400);
		expect(sources.height).toBe(1867);
	});
});

describe('pagesToPreload', () => {
	it('returns what the next turn will show', () => {
		expect(pagesToPreload({ spreadIndex: 0, side: 'left' }, 'spread', 14)).toEqual([2, 3]);
		expect(pagesToPreload({ spreadIndex: 0, side: 'left' }, 'single', 14)).toEqual([1]);
		expect(pagesToPreload({ spreadIndex: 0, side: 'right' }, 'single', 14)).toEqual([2]);
	});

	it('returns nothing at the last position', () => {
		expect(pagesToPreload({ spreadIndex: 6, side: 'left' }, 'spread', 14)).toEqual([]);
		expect(pagesToPreload({ spreadIndex: 6, side: 'right' }, 'single', 14)).toEqual([]);
	});
});
