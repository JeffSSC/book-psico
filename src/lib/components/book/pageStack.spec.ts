import { describe, expect, it } from 'vitest';
import { placeSheet } from './pageStack';

describe('page stack placement', () => {
	it('puts the current page on top of the right pile', () => {
		expect(placeSheet(0, 0, 12)).toEqual({ side: 'right', depth: 0 });
		expect(placeSheet(5, 5, 12)).toEqual({ side: 'right', depth: 0 });
	});

	it('piles unread pages beneath the current one', () => {
		expect(placeSheet(6, 5, 12)).toEqual({ side: 'right', depth: 1 });
		expect(placeSheet(11, 5, 12)).toEqual({ side: 'right', depth: 6 });
	});

	it('piles finished pages on the left with the latest on top', () => {
		expect(placeSheet(4, 5, 12)).toEqual({ side: 'left', depth: 0 });
		expect(placeSheet(0, 5, 12)).toEqual({ side: 'left', depth: 4 });
	});

	it('keeps the final page on the right while it is being read', () => {
		expect(placeSheet(11, 11, 12)).toEqual({ side: 'right', depth: 0 });
		expect(placeSheet(10, 11, 12)).toEqual({ side: 'left', depth: 0 });
	});

	it('clamps an out-of-range reading position instead of misplacing sheets', () => {
		expect(placeSheet(0, -1, 12)).toEqual({ side: 'right', depth: 0 });
		expect(placeSheet(11, 99, 12)).toEqual({ side: 'right', depth: 0 });
		expect(placeSheet(10, 99, 12)).toEqual({ side: 'left', depth: 0 });
	});
});
