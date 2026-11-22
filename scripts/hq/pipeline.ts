import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export interface Size {
	width: number;
	height: number;
}

export interface Box extends Size {
	left: number;
	top: number;
}

export type ImageFormat = 'avif' | 'webp';

/** Largest share of an axis that normalising a page may cut away. */
const MAX_CROP_LOSS = 0.02;

/**
 * Largest centred box of `aspect` (width / height) inside `size`.
 * Throws when the crop would cut more than MAX_CROP_LOSS of an axis.
 */
export function fitToAspect(size: Size, aspect: number, label: string): Box {
	const width = Math.min(size.width, Math.round(size.height * aspect));
	const height = Math.min(size.height, Math.round(size.width / aspect));
	const loss = Math.max(1 - width / size.width, 1 - height / size.height);
	if (loss > MAX_CROP_LOSS) {
		throw new Error(
			`${label}: fitting ${size.width}x${size.height} to aspect ${aspect.toFixed(3)} would cut ${(loss * 100).toFixed(1)}% of the art`
		);
	}
	return {
		left: Math.floor((size.width - width) / 2),
		top: Math.floor((size.height - height) / 2),
		width,
		height
	};
}

export function outputName(page: number, width: number, format: ImageFormat): string {
	return `${String(page).padStart(2, '0')}-${width}.${format}`;
}

export interface ManifestPage {
	page: number;
	width: number;
	height: number;
	color: string;
}

export interface PipelineOptions {
	sourceDir: string;
	outDir: string;
	manifestPath: string;
	widths: number[];
}

/** The first source file is the cover; it keeps its own proportions. */
const COVER_PAGE = 1;
const STORY_ASPECT = 3 / 4;
/** Channel distance from pure white still treated as border. */
const TRIM_THRESHOLD = 12;
/** Pixels shaved after trimming to drop the anti-aliased halo of the border. */
const HALO = 2;

/**
 * Trims the white border of one source page and writes it as AVIF and WebP
 * at each width (never wider than the trimmed art). Story pages are
 * normalised to 3:4 so the two halves of a spread align.
 */
export async function processPage(
	source: string,
	page: number,
	options: Pick<PipelineOptions, 'outDir' | 'widths'>
): Promise<ManifestPage> {
	const label = `page ${page}`;
	const trimmed = await sharp(source)
		.removeAlpha()
		.trim({ background: '#ffffff', threshold: TRIM_THRESHOLD })
		.toBuffer({ resolveWithObject: true });
	const inner: Size = {
		width: trimmed.info.width - HALO * 2,
		height: trimmed.info.height - HALO * 2
	};
	const fitted: Box =
		page === COVER_PAGE ? { left: 0, top: 0, ...inner } : fitToAspect(inner, STORY_ASPECT, label);
	const art = await sharp(trimmed.data)
		.extract({ ...fitted, left: fitted.left + HALO, top: fitted.top + HALO })
		.toBuffer();

	await mkdir(options.outDir, { recursive: true });
	let largest: Size = { width: 0, height: 0 };
	for (const nominal of options.widths) {
		const width = Math.min(nominal, fitted.width);
		const height =
			page === COVER_PAGE
				? Math.round((width * fitted.height) / fitted.width)
				: Math.round(width / STORY_ASPECT);
		const resized = sharp(art).resize(width, height, { fit: 'fill' });
		await resized
			.clone()
			.avif({ quality: 55, effort: 6 })
			.toFile(join(options.outDir, outputName(page, nominal, 'avif')));
		await resized
			.clone()
			.webp({ quality: 78, effort: 6 })
			.toFile(join(options.outDir, outputName(page, nominal, 'webp')));
		if (width > largest.width) largest = { width, height };
	}

	const { dominant } = await sharp(art).stats();
	const color =
		'#' + [dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('');
	return { page, ...largest, color };
}

/**
 * Processes every `N.png` of the source folder in numeric order and writes
 * the manifest the app reads the page geometry from.
 */
export async function processAll(options: PipelineOptions): Promise<ManifestPage[]> {
	const pages = (await readdir(options.sourceDir))
		.map((name) => /^(\d+)\.png$/.exec(name))
		.filter((match) => match !== null)
		.map((match) => Number(match[1]))
		.sort((a, b) => a - b);

	const manifest: ManifestPage[] = [];
	for (const page of pages) {
		manifest.push(await processPage(join(options.sourceDir, `${page}.png`), page, options));
	}
	await writeFile(options.manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
	return manifest;
}
