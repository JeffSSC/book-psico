import { describe, expect, it } from 'vitest';
import {
	PAGE_THICKNESS,
	PAGE_WIDTH,
	RESTING_PROFILE,
	TURNING_PROFILE,
	applyRestProfile,
	applyTurnPose,
	createPageSheet,
	type PageSheet,
	type TurnPose
} from './pageGeometry';

function positions(sheet: PageSheet): Float32Array {
	return sheet.geometry.getAttribute('position').array as Float32Array;
}

function isFiniteSheet(sheet: PageSheet): boolean {
	const array = positions(sheet);
	for (let i = 0; i < array.length; i++) {
		if (!Number.isFinite(array[i])) return false;
	}
	return true;
}

const flatPose: TurnPose = {
	hingeAngle: 0,
	curl: 0,
	curlSign: 1,
	bow: 0,
	profile: TURNING_PROFILE,
	profileWeight: 1
};

describe('page geometry', () => {
	it('builds a sheet that spans from the spine to the fore-edge', () => {
		const sheet = createPageSheet('right');
		applyRestProfile(sheet, RESTING_PROFILE);
		const array = positions(sheet);

		let minX = Infinity;
		let maxX = -Infinity;
		for (let i = 0; i < array.length; i += 3) {
			minX = Math.min(minX, array[i]);
			maxX = Math.max(maxX, array[i]);
		}

		expect(isFiniteSheet(sheet)).toBe(true);
		expect(minX).toBeCloseTo(0, 5);
		expect(maxX).toBeCloseTo(PAGE_WIDTH, 5);
		expect(sheet.geometry.getAttribute('uv')).toBeDefined();
		expect(sheet.geometry.groups).toHaveLength(3);
	});

	it('mirrors the left sheet across the spine', () => {
		const left = createPageSheet('left');
		applyRestProfile(left, RESTING_PROFILE);
		const array = positions(left);

		let minX = Infinity;
		let maxX = -Infinity;
		for (let i = 0; i < array.length; i += 3) {
			minX = Math.min(minX, array[i]);
			maxX = Math.max(maxX, array[i]);
		}

		expect(isFiniteSheet(left)).toBe(true);
		expect(maxX).toBeCloseTo(0, 5);
		expect(minX).toBeCloseTo(-PAGE_WIDTH, 5);
	});

	it('keeps the reading surface above the paper block', () => {
		const sheet = createPageSheet('right');
		applyRestProfile(sheet, RESTING_PROFILE);
		const array = positions(sheet);
		const frontCount = sheet.restX.length / 2;

		// The block below is curved with the same profile, so the reading surface
		// must never dip through it. Only the front face matters here; the back
		// face sits half a paper thickness lower, inside the sheet itself.
		let minFrontY = Infinity;
		for (let n = 0; n < frontCount; n++) {
			minFrontY = Math.min(minFrontY, array[n * 3 + 1]);
		}

		expect(minFrontY).toBeGreaterThan(-RESTING_PROFILE.gutterDepth - 1e-4);
		expect(minFrontY).toBeLessThan(RESTING_PROFILE.archHeight);
	});

	it('starts and ends a turn exactly on the resting page', () => {
		const sheet = createPageSheet('right');
		applyRestProfile(sheet, RESTING_PROFILE);
		const resting = Float32Array.from(positions(sheet));

		applyTurnPose(sheet, { ...flatPose, profile: RESTING_PROFILE });
		const start = positions(sheet);
		for (let i = 0; i < resting.length; i++) {
			expect(start[i]).toBeCloseTo(resting[i], 4);
		}

		// Landing on the left: the sheet has flipped over, so its front face ends
		// up underneath — each vertex matches the opposite face at rest.
		applyTurnPose(sheet, {
			...flatPose,
			hingeAngle: Math.PI,
			curlSign: -1,
			profile: RESTING_PROFILE
		});
		const landed = positions(sheet);
		const faceCount = sheet.restX.length / 2;
		for (let n = 0; n < sheet.restX.length; n++) {
			const opposite = n < faceCount ? n + faceCount : n - faceCount;
			expect(landed[n * 3]).toBeCloseTo(-resting[n * 3], 4);
			expect(landed[n * 3 + 1]).toBeCloseTo(resting[opposite * 3 + 1], 4);
			expect(landed[n * 3 + 2]).toBeCloseTo(resting[n * 3 + 2], 4);
		}
	});

	it('lifts the sheet into the air without producing NaN', () => {
		const sheet = createPageSheet('right');
		applyRestProfile(sheet, RESTING_PROFILE);

		let highest = -Infinity;
		// Includes the degenerate poses where the curl collapses to zero.
		for (let step = 0; step <= 40; step++) {
			const progress = step / 40;
			applyTurnPose(sheet, {
				hingeAngle: Math.PI * progress,
				curl: 1.15 * Math.sin(Math.PI * progress),
				curlSign: 1,
				bow: 0.03 * Math.sin(Math.PI * progress),
				profile: TURNING_PROFILE,
				profileWeight: 1 - 0.5 * Math.sin(Math.PI * progress)
			});

			expect(isFiniteSheet(sheet)).toBe(true);
			const array = positions(sheet);
			for (let i = 1; i < array.length; i += 3) highest = Math.max(highest, array[i]);
		}

		expect(highest).toBeGreaterThan(PAGE_THICKNESS);
	});

	it('keeps the paper thickness on both faces', () => {
		const sheet = createPageSheet('right');
		applyRestProfile(sheet, RESTING_PROFILE);

		// Front and back faces share a centreline, offset by the paper thickness.
		const half = PAGE_THICKNESS / 2;
		const array = positions(sheet);
		const frontIndex = 0;
		const backIndex = sheet.restX.length / 2;
		expect(array[frontIndex * 3 + 1] - array[backIndex * 3 + 1]).toBeCloseTo(half * 2, 6);
	});
});
