import { describe, expect, it } from 'vitest';
import { bookMeta } from './bookMeta';
import { bookUiCopy, fillCopy } from './uiCopy';

/**
 * The book components and painters ship no copy of their own any more, so the
 * only thing standing between a blank surface and a blank label is the data in
 * this folder. These checks are the contract that data has to keep.
 */

interface Leaf {
	path: string;
	value: string;
}

/** Walks every string leaf of a copy tree, templates included. */
function collectLeaves(value: unknown, path = ''): Leaf[] {
	if (typeof value === 'string') return [{ path, value }];
	if (Array.isArray(value)) {
		return value.flatMap((entry, i) => collectLeaves(entry, `${path}[${i}]`));
	}
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, entry]) =>
			collectLeaves(entry, path ? `${path}.${key}` : key)
		);
	}
	return [];
}

const metaLeaves = collectLeaves(bookMeta);
const copyLeaves = collectLeaves(bookUiCopy);

/** Every `{token}` placeholder a template uses. */
function tokensOf(template: string): string[] {
	return [...template.matchAll(/\{(\w+)\}/g)].map(([, token]) => token);
}

const templates = [...metaLeaves, ...copyLeaves].filter((leaf) => leaf.value.includes('{'));

describe('bookMeta', () => {
	it('names the work and the document', () => {
		expect(bookMeta.title.trim()).not.toBe('');
		expect(bookMeta.seo.title).toContain(bookMeta.title);
		expect(bookMeta.seo.description.trim()).not.toBe('');
	});

	it('carries every string the cover board and the sheet backs print', () => {
		expect(bookMeta.cover.titleLines.length).toBeGreaterThan(0);
		expect(bookMeta.cover.subtitleLines.length).toBeGreaterThan(0);
		expect(metaLeaves.length).toBe(
			// title + seo(2) + cover(7) + back(3) + titlePage(2) + titlePageDom(2)
			1 + 2 + 7 + 3 + 2 + 2
		);
	});

	it('has no blank strings', () => {
		for (const leaf of metaLeaves) {
			expect(leaf.value.trim(), `${leaf.path} must not be blank`).not.toBe('');
		}
	});
});

describe('bookUiCopy', () => {
	it('fills every group the interfaces read from', () => {
		expect(Object.keys(bookUiCopy).sort()).toEqual([
			'audio',
			'chrome',
			'experience',
			'interactive',
			'reader',
			'sections',
			'tableOfContents'
		]);
	});

	it('has no blank strings', () => {
		expect(copyLeaves.length).toBeGreaterThan(0);
		for (const leaf of copyLeaves) {
			expect(leaf.value.trim(), `${leaf.path} must not be blank`).not.toBe('');
		}
	});

	it('spells the interactive labels the way each surface renders them', () => {
		// The DOM uppercases the labels with CSS while the canvas bakes its own
		// casing, so the two spellings have to stay in step. The canvas drops the
		// trailing colon because it letter-spaces the label instead.
		expect(bookUiCopy.interactive.canvasBadge).toBe(bookUiCopy.interactive.badge.toUpperCase());
		expect(bookUiCopy.interactive.canvasReflectionTitle).toBe(
			bookUiCopy.interactive.reflectionTitle.replace(/:$/, '').toUpperCase()
		);
	});

	it('exposes only word tokens in its templates', () => {
		for (const leaf of templates) {
			for (const token of tokensOf(leaf.value)) {
				expect(token, `${leaf.path} has an unusable placeholder`).toMatch(/^\w+$/);
			}
		}
	});
});

describe('fillCopy', () => {
	it('substitutes the tokens it is given', () => {
		expect(fillCopy(bookUiCopy.experience.regionLabel, { title: bookMeta.title })).toContain(
			bookMeta.title
		);
		expect(fillCopy(bookUiCopy.chrome.pageCounterTemplate, { current: '02', total: '12' })).toBe(
			'Página 02 de 12'
		);
		expect(fillCopy(bookUiCopy.sections.chapterLabelTemplate, { number: 3, title: 'X' })).toBe(
			'Capítulo 3 • X'
		);
	});

	it('accepts numbers as well as strings', () => {
		expect(fillCopy(bookUiCopy.tableOfContents.progressTemplate, { percent: 50 })).toBe(
			'Progresso: 50%'
		);
		expect(fillCopy(bookUiCopy.tableOfContents.totalTemplate, { count: 12 })).toBe(
			'Total: 12 páginas'
		);
	});

	it('leaves unknown tokens untouched so a typo surfaces instead of vanishing', () => {
		expect(fillCopy('a {known} b {unknown} c', { known: 'X' })).toBe('a X b {unknown} c');
	});

	it('returns copy without placeholders unchanged', () => {
		expect(fillCopy(bookUiCopy.chrome.previousLabel, {})).toBe(bookUiCopy.chrome.previousLabel);
	});
});
