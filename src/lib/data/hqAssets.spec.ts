import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import manifest from './hqManifest.json';

/**
 * Checks on the committed page images (`pnpm hq:build` output): what ships
 * is complete, light, and free of the white border of the source scans.
 */

const ASSET_DIR = join(process.cwd(), 'src/lib/assets/hq');
const PAGES = Array.from({ length: 15 }, (_, i) => i + 1);
const WIDTHS = [720, 1400];
const FORMATS = ['avif', 'webp'];
const KB = 1024;
const NEAR_WHITE = 245;

const file = (page: number, width: number, format: string) =>
	join(ASSET_DIR, `${String(page).padStart(2, '0')}-${width}.${format}`);
const bytes = (page: number, width: number, format: string) =>
	statSync(file(page, width, format)).size;

describe('committed HQ page images', () => {
	it('every page has AVIF and WebP at 720 and 1400', () => {
		for (const page of PAGES) {
			for (const width of WIDTHS) {
				for (const format of FORMATS) {
					expect(existsSync(file(page, width, format)), file(page, width, format)).toBe(true);
				}
			}
		}
		expect(manifest.map((entry) => entry.page)).toEqual(PAGES);
	});

	it('the manifest matches the largest image of each page', async () => {
		for (const entry of manifest) {
			const { width, height } = await sharp(file(entry.page, 1400, 'avif')).metadata();
			expect({ width, height }).toEqual({ width: entry.width, height: entry.height });
		}
	});

	it('images stay inside the size budget', () => {
		for (const page of PAGES) {
			expect(bytes(page, 720, 'avif'), `page ${page} at 720`).toBeLessThanOrEqual(150 * KB);
			expect(bytes(page, 1400, 'avif'), `page ${page} at 1400`).toBeLessThanOrEqual(300 * KB);
		}
		expect(bytes(1, 720, 'avif')).toBeLessThanOrEqual(120 * KB);

		const wholeComic = PAGES.reduce((sum, page) => sum + bytes(page, 720, 'avif'), 0);
		expect(wholeComic).toBeLessThanOrEqual(1.8 * KB * KB);
	});

	it('no committed page has a white outer border', async () => {
		for (const page of PAGES) {
			const { data, info } = await sharp(file(page, 720, 'webp'))
				.removeAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });
			const { width, height, channels } = info;
			const isWhite = (x: number, y: number) => {
				const i = (y * width + x) * channels;
				return data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;
			};
			const rowIsWhite = (y: number) =>
				Array.from({ length: width }, (_, x) => isWhite(x, y)).every(Boolean);
			const colIsWhite = (x: number) =>
				Array.from({ length: height }, (_, y) => isWhite(x, y)).every(Boolean);

			expect(rowIsWhite(0), `page ${page} top`).toBe(false);
			expect(rowIsWhite(height - 1), `page ${page} bottom`).toBe(false);
			expect(colIsWhite(0), `page ${page} left`).toBe(false);
			expect(colIsWhite(width - 1), `page ${page} right`).toBe(false);
		}
	});
});
