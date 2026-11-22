import { describe, expect, it } from 'vitest';
import { bookMeta } from './bookMeta';
import { bookUiCopy, fillCopy } from './uiCopy';

/**
 * The components ship no copy of their own, so the only thing standing
 * between a blank surface and a blank label is the data in this folder.
 * These checks are the contract that data has to keep.
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
	it('names the work', () => {
		expect(bookMeta.title).toBe('O Parque dos Mil Olhos');
		expect(bookMeta.seo.title).toContain(bookMeta.title);
		expect(bookMeta.seo.description).toContain(bookMeta.title);
	});

	it('has no blank strings', () => {
		expect(metaLeaves.length).toBeGreaterThan(0);
		for (const leaf of metaLeaves) {
			expect(leaf.value.trim(), `${leaf.path} must not be blank`).not.toBe('');
		}
	});
});

describe('bookUiCopy', () => {
	it('has only the labels the bare reader needs', () => {
		expect(Object.keys(bookUiCopy).sort()).toEqual(['experience', 'reader']);
		expect(bookUiCopy.reader.previousRegionLabel).toBe('Página anterior');
		expect(bookUiCopy.reader.nextRegionLabel).toBe('Próxima página');
	});

	it('has no blank strings', () => {
		expect(copyLeaves.length).toBeGreaterThan(0);
		for (const leaf of copyLeaves) {
			expect(leaf.value.trim(), `${leaf.path} must not be blank`).not.toBe('');
		}
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
		expect(fillCopy(bookUiCopy.experience.regionLabel, { title: bookMeta.title })).toBe(
			`HQ ${bookMeta.title}`
		);
	});

	it('accepts numbers as well as strings', () => {
		expect(fillCopy('{current} de {total}', { current: 2, total: 14 })).toBe('2 de 14');
	});

	it('leaves unknown tokens untouched so a typo surfaces instead of vanishing', () => {
		expect(fillCopy('a {known} b {unknown} c', { known: 'X' })).toBe('a X b {unknown} c');
	});

	it('returns copy without placeholders unchanged', () => {
		expect(fillCopy(bookUiCopy.reader.nextRegionLabel, {})).toBe(bookUiCopy.reader.nextRegionLabel);
	});
});
