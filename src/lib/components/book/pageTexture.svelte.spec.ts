import { beforeAll, describe, expect, it } from 'vitest';
import type { BookPage } from '../../types/book';
import { bookMeta } from '../../data/bookMeta';
import { bookUiCopy } from '../../data/uiCopy';
import {
	PAGE_TEX_HEIGHT,
	PAGE_TEX_SCALE,
	PAGE_TEX_WIDTH,
	createPaperGrain,
	ensurePageFonts,
	paintPage,
	paintStaticBack,
	type PageHitRegion,
	type PagePaintState
} from './pageTexture';

/**
 * Named `*.svelte.spec.ts` so it runs in the browser project: the painter needs
 * a real 2D canvas context.
 */

const standardPage: BookPage = {
	id: 'test-standard',
	pageNumber: 4,
	chapterNumber: 1,
	chapterTitle: 'Capítulo de Teste',
	type: 'standard',
	title: 'Um Título de Teste',
	subtitle: 'Subtítulo itálico',
	paragraphs: [
		'Primeiro parágrafo com texto suficiente para ocupar mais de uma linha e forçar a quebra automática.',
		'Segundo parágrafo usado para testar o alinhamento e o entrelinhamento do texto pintado.',
		'Terceiro parágrafo curto.'
	],
	callout: { title: 'Atenção', text: 'Texto do bloco de destaque.', type: 'insight' }
};

const interactivePage: BookPage = {
	id: 'test-interactive',
	pageNumber: 5,
	chapterNumber: 2,
	chapterTitle: 'Dilema',
	type: 'standard',
	title: 'Escolha uma opção',
	interactive: {
		activityType: 'dilemma',
		title: 'Dilema',
		prompt: 'O que você faria?',
		options: [
			{ id: 'a', label: 'Opção A', reflection: 'Reflexão sobre a opção A.' },
			{ id: 'b', label: 'Opção B', reflection: 'Reflexão sobre a opção B.' }
		]
	}
};

const indexPage: BookPage = {
	id: 'test-index',
	pageNumber: 3,
	type: 'index',
	title: 'Índice',
	indexEntries: [
		{ title: 'Primeiro capítulo', pageNumber: 4 },
		{ title: 'Segundo capítulo', pageNumber: 6 }
	]
};

let grain: CanvasPattern | null = null;

beforeAll(async () => {
	await ensurePageFonts();
	grain = createPaperGrain(document.createElement('canvas').getContext('2d'));
});

function paint(page: BookPage, overrides: Partial<PagePaintState> = {}) {
	const canvas = document.createElement('canvas');
	canvas.width = PAGE_TEX_WIDTH * PAGE_TEX_SCALE;
	canvas.height = PAGE_TEX_HEIGHT * PAGE_TEX_SCALE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');

	const state: PagePaintState = {
		page,
		pages: [standardPage, interactivePage, indexPage],
		index: 0,
		hoverId: null,
		selectedOptionId: null,
		meta: bookMeta,
		copy: bookUiCopy,
		...overrides
	};

	const regions = paintPage(ctx, state, grain);
	return { canvas, ctx, regions };
}

function expectInsidePage(regions: PageHitRegion[]) {
	for (const region of regions) {
		expect(region.x).toBeGreaterThanOrEqual(-1);
		expect(region.y).toBeGreaterThanOrEqual(-1);
		expect(region.x + region.w).toBeLessThanOrEqual(PAGE_TEX_WIDTH + 1);
		expect(region.y + region.h).toBeLessThanOrEqual(PAGE_TEX_HEIGHT + 1);
		expect(region.w).toBeGreaterThan(0);
		expect(region.h).toBeGreaterThan(0);
	}
}

describe('page painter', () => {
	it('paints a chapter page with navigation controls inside the paper', () => {
		const { regions } = paint(standardPage, { index: 0 });

		const ids = regions.map((r) => r.id);
		expect(ids).toContain('nav-next');
		expect(ids).not.toContain('nav-prev');
		expectInsidePage(regions);
	});

	it('enables the previous control once past the first page', () => {
		const { regions } = paint(standardPage, { index: 1 });
		const ids = regions.map((r) => r.id);
		expect(ids).toContain('nav-prev');
		expect(ids).toContain('nav-next');
	});

	it('exposes only the close control in the top chrome', () => {
		const { regions } = paint(standardPage);
		const ids = regions.map((r) => r.id);
		expect(ids).toContain('close-book');
		// The table of contents button was removed from the page chrome, so no
		// region may be emitted for it any more.
		expect(ids).not.toContain('toc');
		expectInsidePage(regions);
	});

	it('emits one clickable row per index entry', () => {
		const { regions } = paint(indexPage);
		const entries = regions.filter((r) => r.id.startsWith('index:'));
		expect(entries).toHaveLength(2);
		expect(entries.map((e) => e.id)).toEqual(['index:4', 'index:6']);
		expectInsidePage(regions);
	});

	it('emits one hit area per interactive option and keeps it when answered', () => {
		const unanswered = paint(interactivePage, { index: 1 });
		const optionIds = unanswered.regions.filter((r) => r.id.startsWith('option:')).map((r) => r.id);
		expect(optionIds).toEqual(['option:a', 'option:b']);
		expectInsidePage(unanswered.regions);

		const answered = paint(interactivePage, {
			index: 1,
			selectedOptionId: 'b'
		});
		expect(answered.regions.filter((r) => r.id.startsWith('option:'))).toHaveLength(2);
		// The analysis panel makes the page taller, so the answers must repaint.
		expect(answered.regions.length).toBeGreaterThanOrEqual(unanswered.regions.length);
	});

	it('lays the text out in a stable order across repaints', () => {
		const first = paint(standardPage, { index: 0 }).regions;
		const second = paint(standardPage, { index: 0 }).regions;
		expect(second).toEqual(first);
	});

	it('scales long chapters so the content stays on the paper', () => {
		const longPage: BookPage = {
			...standardPage,
			id: 'test-long',
			paragraphs: Array.from(
				{ length: 9 },
				(_, i) =>
					`Parágrafo ${i + 1}. ` +
					'Texto repetido o suficiente para forçar várias linhas quebradas automaticamente dentro da coluna. ' +
					'Palavras adicionais para garantir que a quebra ocorra.'
			)
		};

		const { regions } = paint(longPage, { index: 0 });
		// Every control is clamped to the sheet, so a runaway layout would throw
		// the navigation off the bottom of the page.
		expectInsidePage(regions);
		expect(regions.some((r) => r.id === 'nav-next')).toBe(true);
	});

	it('shades both outer edges so one texture serves both faces', () => {
		const { ctx } = paint(standardPage);
		const sample = (x: number) => {
			const d = ctx.getImageData(x, 715 * PAGE_TEX_SCALE, 1, 1).data;
			return d[0] + d[1] + d[2];
		};
		const leftEdge = sample(10);
		const rightEdge = sample(PAGE_TEX_WIDTH * PAGE_TEX_SCALE - 10);
		// Both samples land in the paper margins: bright paper, shaded equally.
		expect(leftEdge).toBeGreaterThan(400);
		expect(rightEdge).toBeGreaterThan(400);
		expect(Math.abs(leftEdge - rightEdge)).toBeLessThan(60);
	});

	it('paints a static back with no interactive regions', () => {
		const canvas = document.createElement('canvas');
		canvas.width = PAGE_TEX_WIDTH * PAGE_TEX_SCALE;
		canvas.height = PAGE_TEX_HEIGHT * PAGE_TEX_SCALE;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2D canvas unavailable');

		expect(() => paintStaticBack(ctx, grain, bookMeta)).not.toThrow();

		const sample = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
		let dark = 0;
		for (let i = 0; i < sample.length; i += 4 * PAGE_TEX_SCALE) {
			if (sample[i] < 120) dark++;
		}
		// The mark (eye motif, title, quote) must actually be on the paper.
		expect(dark).toBeGreaterThan(500);
	});

	it('actually marks the canvas instead of leaving it blank', () => {
		const { ctx } = paint(standardPage);
		const sample = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
		let dark = 0;
		for (let i = 0; i < sample.length; i += 4 * PAGE_TEX_SCALE) {
			if (sample[i] < 120) dark++;
		}
		expect(dark).toBeGreaterThan(500);
	});
});
