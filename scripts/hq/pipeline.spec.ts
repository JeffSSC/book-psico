import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fitToAspect, outputName, processAll, processPage } from './pipeline';

const STORY_ASPECT = 3 / 4;

describe('fitToAspect', () => {
	it('returns the largest centred box of the target aspect', () => {
		expect(fitToAspect({ width: 1414, height: 1909 }, STORY_ASPECT, 'page 2')).toEqual({
			left: 0,
			top: 12,
			width: 1414,
			height: 1885
		});
		expect(fitToAspect({ width: 1401, height: 1865 }, STORY_ASPECT, 'page 8')).toEqual({
			left: 1,
			top: 0,
			width: 1399,
			height: 1865
		});
	});

	it('never returns a box larger than the input', () => {
		const sizes = [
			{ width: 1414, height: 1909 },
			{ width: 1401, height: 1865 },
			{ width: 1500, height: 2000 }
		];
		for (const size of sizes) {
			const box = fitToAspect(size, STORY_ASPECT, 'page');
			expect(box.left + box.width).toBeLessThanOrEqual(size.width);
			expect(box.top + box.height).toBeLessThanOrEqual(size.height);
		}
	});

	it('rejects a crop that loses more than 2% on an axis', () => {
		expect(() => fitToAspect({ width: 1406, height: 1981 }, STORY_ASPECT, 'page 1')).toThrow(
			/page 1/
		);
	});
});

describe('outputName', () => {
	it('zero-pads the page and names width and format', () => {
		expect(outputName(3, 720, 'avif')).toBe('03-720.avif');
		expect(outputName(12, 1400, 'webp')).toBe('12-1400.webp');
	});
});

const WHITE = { r: 255, g: 255, b: 255 };
const NEAR_WHITE = 245;

interface Fixture {
	/** Size of the coloured art block. */
	art: { width: number; height: number };
	border?: { top?: number; right?: number; bottom?: number; left?: number };
	/** White band painted across the middle of the art. */
	stripe?: boolean;
}

/** Writes a PNG of a coloured block on a white canvas and returns its path. */
async function writeFixture(dir: string, name: string, fixture: Fixture): Promise<string> {
	const { top = 0, right = 0, bottom = 0, left = 0 } = fixture.border ?? {};
	const { width, height } = fixture.art;
	const layers: OverlayOptions[] = [
		{
			input: { create: { width, height, channels: 3, background: { r: 30, g: 70, b: 120 } } },
			left,
			top
		}
	];
	if (fixture.stripe) {
		const stripeWidth = width - 80;
		layers.push({
			input: { create: { width: stripeWidth, height: 40, channels: 3, background: WHITE } },
			left: left + 40,
			top: top + Math.round(height / 2) - 20
		});
	}
	const path = join(dir, name);
	await sharp({
		create: {
			width: left + width + right,
			height: top + height + bottom,
			channels: 3,
			background: WHITE
		}
	})
		.composite(layers)
		.png()
		.toFile(path);
	return path;
}

/** True when every pixel of some outer row or column is near-white. */
async function hasWhiteEdge(file: string): Promise<boolean> {
	const { data, info } = await sharp(file)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width, height, channels } = info;
	const isWhite = (x: number, y: number) => {
		const i = (y * width + x) * channels;
		return data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;
	};
	const row = (y: number) => Array.from({ length: width }, (_, x) => isWhite(x, y)).every(Boolean);
	const col = (x: number) => Array.from({ length: height }, (_, y) => isWhite(x, y)).every(Boolean);
	return row(0) || row(height - 1) || col(0) || col(width - 1);
}

async function sizeOf(file: string) {
	const { width, height } = await sharp(file).metadata();
	return { width, height };
}

describe('page pipeline', () => {
	let dir: string;
	let outDir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'hq-pipeline-'));
		outDir = join(dir, 'out');
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('trims the white border from every side', async () => {
		const source = await writeFixture(dir, '2.png', {
			art: { width: 420, height: 560 },
			border: { top: 20, bottom: 20, left: 6 }
		});
		await processPage(source, 2, { outDir, widths: [300] });

		for (const format of ['avif', 'webp'] as const) {
			expect(await hasWhiteEdge(join(outDir, outputName(2, 300, format)))).toBe(false);
		}
	});

	it('keeps white that is inside the art', async () => {
		const source = await writeFixture(dir, '2.png', {
			art: { width: 420, height: 560 },
			border: { top: 20, bottom: 20, left: 6, right: 6 },
			stripe: true
		});
		await processPage(source, 2, { outDir, widths: [300] });

		const file = join(outDir, outputName(2, 300, 'webp'));
		const { data, info } = await sharp(file)
			.removeAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const centre = (Math.round(info.height / 2) * info.width + Math.round(info.width / 2)) * 3;
		expect(data[centre]).toBeGreaterThanOrEqual(NEAR_WHITE);
		expect(data[centre + 1]).toBeGreaterThanOrEqual(NEAR_WHITE);
		expect(data[centre + 2]).toBeGreaterThanOrEqual(NEAR_WHITE);
	});

	it('story pages come out at exactly 3:4', async () => {
		const taller = await writeFixture(dir, '2.png', {
			art: { width: 420, height: 566 },
			border: { top: 12, bottom: 30 }
		});
		const wider = await writeFixture(dir, '3.png', {
			art: { width: 424, height: 560 },
			border: { left: 9, right: 3, top: 14 }
		});
		await processPage(taller, 2, { outDir, widths: [120, 300] });
		await processPage(wider, 3, { outDir, widths: [120, 300] });

		for (const page of [2, 3]) {
			for (const width of [120, 300]) {
				expect(await sizeOf(join(outDir, outputName(page, width, 'webp')))).toEqual({
					width,
					height: Math.round((width * 4) / 3)
				});
			}
		}
	});

	it('the cover keeps its own aspect', async () => {
		const source = await writeFixture(dir, '1.png', {
			art: { width: 400, height: 563 },
			border: { left: 7, bottom: 19 }
		});
		await processPage(source, 1, { outDir, widths: [300] });

		const { width, height } = await sizeOf(join(outDir, outputName(1, 300, 'avif')));
		expect(Math.abs(width! / height! - 0.71)).toBeLessThanOrEqual(0.005);
	});

	it('emits AVIF and WebP at each width and never upscales', async () => {
		// 1004px of art leaves a 1000px page once the edge halo is shaved.
		const source = await writeFixture(dir, '2.png', {
			art: { width: 1004, height: 1339 },
			border: { top: 30, bottom: 30, left: 10, right: 10 }
		});
		await processPage(source, 2, { outDir, widths: [720, 1400] });

		expect((await readdir(outDir)).sort()).toEqual([
			'02-1400.avif',
			'02-1400.webp',
			'02-720.avif',
			'02-720.webp'
		]);
		for (const format of ['avif', 'webp'] as const) {
			expect((await sizeOf(join(outDir, outputName(2, 720, format)))).width).toBe(720);
			expect((await sizeOf(join(outDir, outputName(2, 1400, format)))).width).toBe(1000);
		}
	});

	it('writes a manifest in numeric page order', async () => {
		const sourceDir = join(dir, 'src');
		await mkdir(sourceDir);
		for (let page = 1; page <= 12; page++) {
			await writeFixture(sourceDir, `${page}.png`, {
				art: { width: 150, height: 200 },
				border: { top: 5, left: 5 }
			});
		}
		const manifestPath = join(dir, 'manifest.json');
		const returned = await processAll({ sourceDir, outDir, manifestPath, widths: [60] });

		const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
		expect(manifest).toEqual(returned);
		expect(manifest.map((entry: { page: number }) => entry.page)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
		]);
		for (const entry of manifest) {
			expect(entry.width).toBeGreaterThan(0);
			expect(entry.height).toBeGreaterThan(0);
			expect(entry.color).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
