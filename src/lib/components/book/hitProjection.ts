import * as THREE from 'three';
import { PAGE_HEIGHT, PAGE_WIDTH } from './pageGeometry';
import { PAGE_TEX_HEIGHT, PAGE_TEX_WIDTH, type PageHitRegion } from './pageTexture';

/**
 * Screen projection for the page controls.
 *
 * The visible page is painted into a WebGL texture, but the controls stay real
 * DOM buttons. CSS3DRenderer cannot be used for them: browsers do not hit-test
 * reliably inside a `transform-style: preserve-3d` subtree, so the page of an
 * open book would swallow every click. Instead each hit rectangle is projected
 * through the camera onto a plain overlay, which keeps native focus, hover and
 * click behaviour.
 */

/** A hit rectangle expressed in container pixels. */
export interface PositionedHitRegion extends PageHitRegion {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface ProjectionOptions {
	/** World x of the page's outer edge; the spine sits at x = 0. */
	outerEdgeX: number;
	/** World height of the page surface. */
	surfaceY: number;
	/** Horizontal scale of the page, used while the cover reveals it. */
	scaleX: number;
	camera: THREE.PerspectiveCamera;
	containerWidth: number;
	containerHeight: number;
}

const corner = new THREE.Vector3();

function projectToScreen(
	x: number,
	y: number,
	z: number,
	options: ProjectionOptions
): { x: number; y: number } {
	corner.set(x, y, z).project(options.camera);
	return {
		x: (corner.x * 0.5 + 0.5) * options.containerWidth,
		y: (-corner.y * 0.5 + 0.5) * options.containerHeight
	};
}

/** Projects a page's hit rectangles onto the viewport. */
export function projectHitRegions(
	regions: PageHitRegion[],
	options: ProjectionOptions
): PositionedHitRegion[] {
	const { outerEdgeX, surfaceY, scaleX } = options;
	const liftedY = surfaceY + 0.01;

	const toWorld = (canvasX: number, canvasY: number) => ({
		x: (outerEdgeX + (canvasX / PAGE_TEX_WIDTH) * PAGE_WIDTH) * scaleX,
		z: -PAGE_HEIGHT / 2 + (canvasY / PAGE_TEX_HEIGHT) * PAGE_HEIGHT
	});

	return regions.map((region) => {
		const left = toWorld(region.x, region.y);
		const right = toWorld(region.x + region.w, region.y + region.h);

		const a = projectToScreen(left.x, liftedY, left.z, options);
		const b = projectToScreen(right.x, liftedY, left.z, options);
		const c = projectToScreen(right.x, liftedY, right.z, options);
		const d = projectToScreen(left.x, liftedY, right.z, options);

		const minX = Math.min(a.x, b.x, c.x, d.x);
		const maxX = Math.max(a.x, b.x, c.x, d.x);
		const minY = Math.min(a.y, b.y, c.y, d.y);
		const maxY = Math.max(a.y, b.y, c.y, d.y);

		return {
			...region,
			left: minX,
			top: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	});
}
