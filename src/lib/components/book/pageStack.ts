import type { PageSide } from './pageGeometry';

/**
 * Placement of one sheet in the book's two piles, derived purely from the
 * reading position. The right pile holds the current page on top with the
 * unread pages beneath it; the left pile holds the finished pages.
 */
export interface SheetPlacement {
	side: PageSide;
	/** 0 for the top sheet of a pile, growing downwards into the pile. */
	depth: number;
}

/** Pure placement rule, kept out of the component so it can be unit-tested. */
export function placeSheet(pageIndex: number, currentIndex: number, total: number): SheetPlacement {
	const current = Math.min(Math.max(currentIndex, 0), Math.max(total - 1, 0));
	if (pageIndex < current) {
		return { side: 'left', depth: current - 1 - pageIndex };
	}
	return { side: 'right', depth: pageIndex - current };
}
