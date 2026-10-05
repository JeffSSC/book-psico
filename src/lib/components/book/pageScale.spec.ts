import { describe, expect, it } from 'vitest';
import {
	GUTTER,
	PAGE_HEIGHT,
	PAGE_WIDTH,
	SPREAD_HEIGHT,
	SPREAD_WIDTH,
	fitScale,
	singleScale,
	spreadScale
} from './pageScale';

describe('pageScale', () => {
	it('defines a 512x720 page and a two-page spread with an 8px gutter', () => {
		expect(PAGE_WIDTH).toBe(512);
		expect(PAGE_HEIGHT).toBe(720);
		expect(GUTTER).toBe(8);
		expect(SPREAD_WIDTH).toBe(512 * 2 + 8);
		expect(SPREAD_HEIGHT).toBe(PAGE_HEIGHT);
	});

	it('is constrained by the tighter dimension', () => {
		// Width is the constraint here.
		expect(fitScale(100, 100, 200, 500)).toBeCloseTo(2);
		// Height is the constraint here.
		expect(fitScale(100, 100, 500, 200)).toBeCloseTo(2);
		// Exactly fitting.
		expect(fitScale(100, 200, 100, 200)).toBeCloseTo(1);
	});

	it('fits the spread inside a desktop viewport', () => {
		const scale = spreadScale(1200, 800);
		expect(scale).toBeCloseTo(Math.min(1200 / SPREAD_WIDTH, 800 / SPREAD_HEIGHT));
		expect(SPREAD_WIDTH * scale).toBeLessThanOrEqual(1200);
		expect(SPREAD_HEIGHT * scale).toBeLessThanOrEqual(800);
	});

	it('fits the single page inside a phone viewport', () => {
		const scale = singleScale(390, 640);
		expect(scale).toBeCloseTo(Math.min(390 / PAGE_WIDTH, 640 / PAGE_HEIGHT));
		expect(PAGE_WIDTH * scale).toBeLessThanOrEqual(390);
		expect(PAGE_HEIGHT * scale).toBeLessThanOrEqual(640);
	});

	it('returns 1 for degenerate viewports', () => {
		expect(fitScale(100, 100, 0, 300)).toBe(1);
		expect(fitScale(100, 100, 300, 0)).toBe(1);
	});
});
