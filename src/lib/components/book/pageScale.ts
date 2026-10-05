/**
 * Fixed geometry of the 2D top-down book.
 *
 * Every page is designed once in a fixed CSS box and then scaled with
 * `transform: scale()` to fit the viewport, so the "paper" keeps the same
 * proportions and type size on every device (see AD/UI/2D-UI.md §3).
 */

export const PAGE_WIDTH = 512;
export const PAGE_HEIGHT = 720;
/** Central fold between the two pages of a spread. */
export const GUTTER = 8;
export const SPREAD_WIDTH = PAGE_WIDTH * 2 + GUTTER;
export const SPREAD_HEIGHT = PAGE_HEIGHT;

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
