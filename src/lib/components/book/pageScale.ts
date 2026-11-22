import type { ViewMode } from '../../types/book';

/**
 * Fixed geometry of the open HQ.
 *
 * Every page is laid out once in a fixed 3:4 CSS box (the shape the page
 * images are published in) and then scaled with `transform: scale()` to fit
 * the viewport.
 */

export const PAGE_WIDTH = 540;
export const PAGE_HEIGHT = 720;
export const SPREAD_WIDTH = PAGE_WIDTH * 2;
export const SPREAD_HEIGHT = PAGE_HEIGHT;

/** Smallest share of the single-page size a spread page may shrink to. */
const MIN_SPREAD_SHARE = 0.75;

/** Share of the real width declared to the browser when it picks an image. */
const SIZES_BIAS = 0.9;

/**
 * `sizes` of one page image, as CSS so it is right before any script runs.
 * Understated a little so a 2x phone takes the 720px file, not the 1400px.
 */
export const PAGE_SIZES = (() => {
	const share = (pagesAcross: number) => (100 / pagesAcross) * SIZES_BIAS;
	const byHeight = `calc(100vh * ${(PAGE_WIDTH / PAGE_HEIGHT) * SIZES_BIAS})`;
	const spreadFrom = Math.round((SPREAD_WIDTH / SPREAD_HEIGHT) * MIN_SPREAD_SHARE * 1000);
	return (
		`(min-aspect-ratio: ${spreadFrom}/1000) min(${share(2)}vw, ${byHeight}), ` +
		`min(${share(1)}vw, ${byHeight})`
	);
})();

/**
 * Uniform scale that fits a `boxW × boxH` element inside the available space;
 * the tighter dimension is the constraint, so the paper always fits whole.
 */
export function fitScale(boxW: number, boxH: number, availW: number, availH: number): number {
	if (availW <= 0 || availH <= 0 || boxW <= 0 || boxH <= 0) return 1;
	return Math.min(availW / boxW, availH / boxH);
}

/** Scale for the two-page spread box. */
export function spreadScale(availW: number, availH: number): number {
	return fitScale(SPREAD_WIDTH, SPREAD_HEIGHT, availW, availH);
}

/** Scale for the single (mobile) page box. */
export function singleScale(availW: number, availH: number): number {
	return fitScale(PAGE_WIDTH, PAGE_HEIGHT, availW, availH);
}

/**
 * Two pages when both fit without shrinking much below what a single page
 * would get; one page otherwise (phones, portrait tablets).
 */
export function viewModeFor(availW: number, availH: number): ViewMode {
	return spreadScale(availW, availH) >= singleScale(availW, availH) * MIN_SPREAD_SHARE
		? 'spread'
		: 'single';
}
