import { describe, expect, it } from 'vitest';
import {
	PAGE_HEIGHT,
	PAGE_WIDTH,
	SPREAD_HEIGHT,
	SPREAD_WIDTH,
	fitScale,
	singleScale,
	PAGE_SIZES,
	spreadScale,
	viewModeFor
} from './pageScale';

describe('pageScale', () => {
	it('defines a 3:4 page and a gutterless spread', () => {
		expect(PAGE_WIDTH / PAGE_HEIGHT).toBe(3 / 4);
		expect(SPREAD_WIDTH).toBe(2 * PAGE_WIDTH);
		expect(SPREAD_HEIGHT).toBe(PAGE_HEIGHT);
	});

	it('viewModeFor picks the spread only when two pages fit well', () => {
		expect(viewModeFor(1440, 900)).toBe('spread');
		expect(viewModeFor(1180, 820)).toBe('spread');
		expect(viewModeFor(390, 844)).toBe('single');
		expect(viewModeFor(820, 1180)).toBe('single');
	});

	it('PAGE_SIZES lets a 2x phone take the 720px image', () => {
		// Phone clause: the share of the viewport width declared for one page.
		const phoneShare = Number(/, min\((\d+)vw/.exec(PAGE_SIZES)![1]) / 100;
		// 390 CSS px at 2x would ask for 780 device px; the hint keeps it under 720.
		expect(390 * phoneShare * 2).toBeLessThanOrEqual(720);
		// A 3x phone still needs, and gets, the large image.
		expect(390 * phoneShare * 3).toBeGreaterThan(720);
		// On a wide screen a page is half the spread, so half the share.
		expect(PAGE_SIZES).toContain(`min(${(phoneShare * 100) / 2}vw`);
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
