import * as THREE from 'three';

/**
 * Real 3D page geometry.
 *
 * Every page is a subdivided sheet that spans from the spine (local `x = 0`)
 * to its outer edge (`x = width`). The sheet has two textured faces (recto /
 * verso) plus a thin paper edge, so it reads as an actual piece of paper once
 * it lifts off the block.
 *
 * The same geometry powers two use-cases:
 *  - resting pages (`applyRestProfile`), which just keep the gutter curve;
 *  - the turning sheet (`applyTurnPose`), which bends the paper along an arc
 *    while it swings around the spine hinge.
 */

/** World dimensions of a single page (the book lies flat on the desk). */
export const PAGE_WIDTH = 2.4;
export const PAGE_HEIGHT = 3.35;
/** Paper thickness, slightly exaggerated so the sheet edge stays readable. */
export const PAGE_THICKNESS = 0.005;

/** Which half of the spread a sheet belongs to. */
export type PageSide = 'right' | 'left';

export interface PageSheet {
	geometry: THREE.BufferGeometry;
	/** Arc length from the spine, always positive. */
	restX: Float32Array;
	restZ: Float32Array;
	/** +1 for the front face verts, -1 for the back face verts. */
	thicknessSign: Float32Array;
	width: number;
	height: number;
	thickness: number;
}

/** Curvature a resting sheet keeps: a dip into the gutter plus a soft arch. */
export interface PageProfile {
	gutterDepth: number;
	archHeight: number;
}

/** Depth of the dip into the spine gutter, and the arch towards the fore-edge. */
const GUTTER_DEPTH = 0.062;
const ARCH_HEIGHT = 0.018;

export const RESTING_PROFILE: PageProfile = {
	gutterDepth: GUTTER_DEPTH,
	archHeight: ARCH_HEIGHT
};
/**
 * The turning sheet keeps the same resting curve so it lands exactly on top of
 * the page it reveals. The in-flight softening is done by `profileWeight`.
 */
export const TURNING_PROFILE: PageProfile = {
	gutterDepth: GUTTER_DEPTH,
	archHeight: ARCH_HEIGHT
};

/**
 * Builds a closed paper sheet. Winding is flipped for the left half so the
 * front face always points up (+Y) once the sheet is lying on the desk.
 */
export function createPageSheet(
	side: PageSide = 'right',
	width = PAGE_WIDTH,
	height = PAGE_HEIGHT,
	thickness = PAGE_THICKNESS,
	widthSegments = 24,
	heightSegments = 28
): PageSheet {
	const nx = widthSegments + 1;
	const nz = heightSegments + 1;
	const gridSize = nx * nz;
	const vertCount = gridSize * 2;

	const positions = new Float32Array(vertCount * 3);
	const uvs = new Float32Array(vertCount * 2);
	const restX = new Float32Array(vertCount);
	const restZ = new Float32Array(vertCount);
	const thicknessSign = new Float32Array(vertCount);

	const dirX = side === 'left' ? -1 : 1;
	const half = thickness / 2;

	for (let j = 0; j < nz; j++) {
		const v = j / (nz - 1);
		const z = -height / 2 + v * height;
		for (let i = 0; i < nx; i++) {
			const u = i / (nx - 1);
			const s = u * width;
			const front = j * nx + i;
			const back = gridSize + front;

			positions[front * 3] = dirX * s;
			positions[front * 3 + 1] = half;
			positions[front * 3 + 2] = z;
			positions[back * 3] = dirX * s;
			positions[back * 3 + 1] = -half;
			positions[back * 3 + 2] = z;

			// The left half is mirrored in world space, so its texture has to
			// be mirrored in U as well to keep the reading orientation.
			const uFront = side === 'left' ? 1 - u : u;
			const uBack = side === 'left' ? u : 1 - u;
			uvs[front * 2] = uFront;
			uvs[front * 2 + 1] = 1 - v;
			uvs[back * 2] = uBack;
			uvs[back * 2 + 1] = 1 - v;

			restX[front] = restX[back] = s;
			restZ[front] = restZ[back] = z;
			thicknessSign[front] = 1;
			thicknessSign[back] = -1;
		}
	}

	const frontIdx: number[] = [];
	const backIdx: number[] = [];
	const edgeIdx: number[] = [];
	/** Mirrored sheets need every triangle reversed to keep outward normals. */
	const flip = side === 'left';
	const tri = (target: number[], a: number, b: number, c: number) => {
		if (flip) target.push(a, c, b);
		else target.push(a, b, c);
	};

	for (let j = 0; j < nz - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i;
			const b = a + 1;
			const c = a + nx;
			const d = c + 1;
			tri(frontIdx, a, c, b);
			tri(frontIdx, b, c, d);
			tri(backIdx, a + gridSize, b + gridSize, c + gridSize);
			tri(backIdx, b + gridSize, d + gridSize, c + gridSize);
		}
	}

	// Paper edge strips reuse the boundary verts, so there is no seam.
	for (let i = 0; i < nx - 1; i++) {
		// Outer fore-edge (x = width) and spine edge (x = 0)
		const spineA = i;
		const spineB = i + 1;
		tri(edgeIdx, spineA, spineB, spineA + gridSize);
		tri(edgeIdx, spineB, spineB + gridSize, spineA + gridSize);

		const foreA = (nz - 1) * nx + i;
		const foreB = foreA + 1;
		tri(edgeIdx, foreA, foreA + gridSize, foreB);
		tri(edgeIdx, foreB, foreA + gridSize, foreB + gridSize);
	}
	for (let j = 0; j < nz - 1; j++) {
		const topA = j * nx;
		const topB = (j + 1) * nx;
		tri(edgeIdx, topA, topB, topA + gridSize);
		tri(edgeIdx, topA + gridSize, topB, topB + gridSize);

		const bottomA = j * nx + (nx - 1);
		const bottomB = bottomA + nx;
		tri(edgeIdx, bottomA, bottomA + gridSize, bottomB);
		tri(edgeIdx, bottomB, bottomA + gridSize, bottomB + gridSize);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
	geometry.setIndex([...frontIdx, ...backIdx, ...edgeIdx.slice()]);
	geometry.clearGroups();
	geometry.addGroup(0, frontIdx.length, 0);
	geometry.addGroup(frontIdx.length, backIdx.length, 1);
	geometry.addGroup(frontIdx.length + backIdx.length, edgeIdx.length, 2);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();

	return {
		geometry,
		restX,
		restZ,
		thicknessSign,
		width,
		height,
		thickness
	};
}

/**
 * Vertical offset of the sheet surface at arc length `u` (0 = spine).
 * Positive values lift the paper, negative ones sink it into the gutter.
 *
 * `u` is clamped because arc lengths are stored as float32, which can push the
 * outer edge a hair past 1 and turn the gutter term into NaN.
 */
function profileOffset(profile: PageProfile, rawU: number, edgeFade: number): number {
	const u = Math.min(Math.max(rawU, 0), 1);
	const gutter = -profile.gutterDepth * Math.pow(1 - u, 2.2);
	const arch = profile.archHeight * Math.sin(Math.PI * u);
	return (gutter + arch) * edgeFade;
}

/** Softens the curve towards the head and tail of the page. */
function edgeFadeFor(z: number, height: number): number {
	return 1 - 0.28 * Math.pow((2 * z) / height, 2);
}

/** Bends the sheet into its resting (flat, gutter-curved) shape. */
export function applyRestProfile(sheet: PageSheet, profile: PageProfile): void {
	const attr = sheet.geometry.getAttribute('position') as THREE.BufferAttribute;
	const arr = attr.array as Float32Array;
	const half = sheet.thickness / 2;

	for (let n = 0; n < sheet.restX.length; n++) {
		const u = sheet.restX[n] / sheet.width;
		const offset = profileOffset(profile, u, edgeFadeFor(sheet.restZ[n], sheet.height));
		arr[n * 3 + 1] = sheet.thicknessSign[n] * half + offset;
	}

	attr.needsUpdate = true;
	sheet.geometry.computeVertexNormals();
	sheet.geometry.computeBoundingSphere();
}

/** Pose of a sheet in flight, rotating around the spine hinge. */
export interface TurnPose {
	/** 0 = lying on the right block, PI = lying on the left cover. */
	hingeAngle: number;
	/** Total bend across the sheet, in radians. 0 keeps it flat. */
	curl: number;
	/** +1 when the hinge angle is growing, -1 when it is shrinking. */
	curlSign: number;
	/** Extra dome so the sheet never looks like a rigid plank. */
	bow: number;
	profile: PageProfile;
	/** Blends the resting profile in and out over the course of the turn. */
	profileWeight: number;
}

/**
 * Bends a sheet around an arc hinged at the spine.
 *
 * The sheet centreline is integrated analytically: the tangent angle grows
 * linearly with the arc length, so the free edge trails behind the hinge and
 * the paper reads as flexible paper instead of a rotating plane.
 *
 * Only ever used with a `right` sided sheet, whose local +X runs from the
 * spine to the fore-edge.
 */
export function applyTurnPose(sheet: PageSheet, pose: TurnPose): void {
	const attr = sheet.geometry.getAttribute('position') as THREE.BufferAttribute;
	const arr = attr.array as Float32Array;
	const half = sheet.thickness / 2;
	const h = pose.hingeAngle;
	const sinH = Math.sin(h);
	const cosH = Math.cos(h);
	const k = (pose.curlSign * pose.curl) / sheet.width;
	const straight = Math.abs(k) < 1e-4;

	for (let n = 0; n < sheet.restX.length; n++) {
		const s = sheet.restX[n];
		const u = s / sheet.width;
		const z = sheet.restZ[n];
		const fade = edgeFadeFor(z, sheet.height);
		const profile =
			(profileOffset(pose.profile, u, fade) + pose.bow * Math.sin(Math.PI * u) * fade) *
			pose.profileWeight;

		let px: number;
		let py: number;
		let nx: number;
		let ny: number;

		if (straight) {
			px = s * cosH;
			py = s * sinH;
			nx = -sinH;
			ny = cosH;
		} else {
			const phi = h + k * s;
			px = (Math.sin(phi) - sinH) / k;
			py = (cosH - Math.cos(phi)) / k;
			nx = -Math.sin(phi);
			ny = Math.cos(phi);
		}

		const t = sheet.thicknessSign[n] * half;
		const offset = n * 3;
		arr[offset] = px + nx * t;
		arr[offset + 1] = py + ny * t + profile;
		arr[offset + 2] = z;
	}

	attr.needsUpdate = true;
	sheet.geometry.computeVertexNormals();
	sheet.geometry.computeBoundingSphere();
}

/** Free running pose helpers, kept here so the component stays declarative. */
export const easeInOutCubic = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
