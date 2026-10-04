import { describe, it, expect } from 'vitest';
import { bookPages } from './bookPages';

describe('Book Structure Specification (AD/BOOK-STRUCTURE.md)', () => {
	it('contains exactly 12 pages in strict linear sequence', () => {
		expect(bookPages).toHaveLength(12);

		bookPages.forEach((page, index) => {
			expect(page.pageNumber).toBe(index + 1);
		});
	});

	it('maps each page to its required archetype and slug', () => {
		const expectedMapping = [
			{ id: 'page-01-cover', type: 'cover' },
			{ id: 'page-02-introduction', type: 'standard' },
			{ id: 'page-03-index', type: 'index' },
			{ id: 'page-04-chapter-1', type: 'standard' },
			{ id: 'page-05-chapter-2', type: 'standard' },
			{ id: 'page-06-chapter-3', type: 'standard' },
			{ id: 'page-07-chapter-4', type: 'standard' },
			{ id: 'page-08-chapter-5', type: 'standard' },
			{ id: 'page-09-chapter-6', type: 'standard' },
			{ id: 'page-10-conclusion', type: 'standard' },
			{ id: 'page-11-references', type: 'references' },
			{ id: 'page-12-authors', type: 'authors' }
		];

		expectedMapping.forEach((expected, i) => {
			expect(bookPages[i].id).toBe(expected.id);
			expect(bookPages[i].type).toBe(expected.type);
		});
	});

	it('validates index entries on page 03', () => {
		const indexPage = bookPages[2];
		expect(indexPage.indexEntries).toBeDefined();
		expect(indexPage.indexEntries!.length).toBeGreaterThanOrEqual(10);
	});

	it('validates academic references on page 11', () => {
		const refPage = bookPages[10];
		expect(refPage.references).toBeDefined();
		expect(refPage.references!.length).toBeGreaterThanOrEqual(3);
		expect(refPage.references![0].author).toContain('Elkind');
	});

	it('validates author profiles on page 12', () => {
		const authorPage = bookPages[11];
		expect(authorPage.authors).toBeDefined();
		expect(authorPage.authors!.length).toBeGreaterThanOrEqual(1);
		expect(authorPage.authors![0].name).toBeTruthy();
	});
});
