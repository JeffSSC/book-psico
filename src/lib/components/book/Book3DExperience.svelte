<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { bookStore } from '../../stores/bookStore.svelte';
	import { bookMeta } from '../../data/bookMeta';
	import { bookUiCopy, fillCopy } from '../../data/uiCopy';
	import type { BookPage } from '../../types/book';
	import PageInteractionLayer from './PageInteractionLayer.svelte';
	import { projectHitRegions, type PositionedHitRegion } from './hitProjection';
	import {
		PAGE_HEIGHT,
		PAGE_WIDTH,
		RESTING_PROFILE,
		TURNING_PROFILE,
		applyRestProfile,
		applyTurnPose,
		createPageSheet,
		type PageSheet
	} from './pageGeometry';
	import { placeSheet } from './pageStack';
	import {
		PAGE_TEX_HEIGHT,
		PAGE_TEX_SCALE,
		PAGE_TEX_WIDTH,
		createPaperGrain,
		ensurePageFonts,
		paintPage,
		paintStaticBack,
		type PageHitRegion,
		type PagePaintState
	} from './pageTexture';
	import { createBookCoverTexture, createPageBlockTexture } from './bookCoverTexture';
	import { createWoodDeskTexture, createDeskPadTexture } from './deskTexture';

	/**
	 * The book as a single physical object with one sheet per page.
	 *
	 * Every page is pre-painted into its own canvas texture and lives on a
	 * real 3D sheet for the whole session. Turning a page physically moves
	 * that sheet from one pile to the other — nothing is ever repainted
	 * mid-flight, so the swap cannot pop. Only the interactive controls live
	 * in the DOM, projected onto the current page each frame.
	 */

	let { pages }: { pages: BookPage[] } = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);

	let rectoRegions = $state<PositionedHitRegion[]>([]);
	let isHoveringCover = $state(false);
	let openProgress = $state(bookStore.isBookOpen ? 1 : 0);

	const overlayActive = $derived(openProgress > 0.9 && !bookStore.isFlipping);

	/* ---------------- Scene state ---------------- */

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let animationFrameId: number | null = null;
	let grain: CanvasPattern | null = null;
	let idleCancelled = false;

	let coverHinge: THREE.Group | null = null;
	let coverMeshRef: THREE.Mesh | null = null;
	let blockMeshRef: THREE.Mesh | null = null;
	/** One static texture shared by every sheet back. */
	let backMatShared: THREE.MeshStandardMaterial | null = null;
	let backCanvas: HTMLCanvasElement | null = null;

	interface SheetState {
		sheet: PageSheet;
		mesh: THREE.Mesh;
		canvas: HTMLCanvasElement;
		ctx: CanvasRenderingContext2D;
		texture: THREE.CanvasTexture;
		regions: PageHitRegion[];
		/** Physical pixel scale currently painted at; 0 means not painted yet. */
		paintedScale: number;
		gpuLive: boolean;
		lastPoseKey: string;
	}
	let sheets: SheetState[] = [];

	// Geometry constants shared with the cover / block layout.
	const BOARD_THICKNESS = 0.05;
	const BLOCK_THICKNESS = 0.16;
	const COVER_THICKNESS = 0.09;
	const COVER_OVERHANG = 0.06;
	/** Top of the paper block; also where the cover hinge sits. */
	const BLOCK_TOP = BOARD_THICKNESS + BLOCK_THICKNESS;
	const PAGE_GAP = 0.003;
	const PAGE_BASE_Y = BLOCK_TOP + PAGE_GAP;

	// Stack step for the left (finished) pile only. The right (unread) pile
	// shares a single reading plane — no vertical stagger.
	const STACK_GAP_LEFT = 0.007;
	const RIGHT_TOP_Y = PAGE_BASE_Y;
	/** Left pile base: just above the open cover's surface at the spine. */
	const LEFT_BASE_Y = BLOCK_TOP + COVER_THICKNESS / 2 + 0.004;
	/** Tilt matching the open cover's slope down to the desk. */
	const LEFT_TILT = 0.055;
	/** Past 180° so the open cover settles its far edge onto the desk. */
	const COVER_OPEN_ANGLE = Math.PI + 0.055;
	/** Sheets deeper than this are hidden (buried in the pile). */
	const VISIBLE_DEPTH = 4;
	/**
	 * Open progress at which the cover has finished falling onto the desk, i.e.
	 * the angle where its inner surface is horizontal. The left pile rests *on*
	 * that cover, so the cover sweeps straight through it for the whole
	 * rotation: the pile cannot exist until the cover is down, and it has to go
	 * away again before the cover starts closing.
	 */
	const COVER_FLAT_PROGRESS = Math.PI / COVER_OPEN_ANGLE;
	/** Nothing is GPU-resident beyond this distance from the reading position. */
	const GPU_DEPTH = 5;

	/* ---------------- Camera ---------------- */

	const overviewPos = new THREE.Vector3();
	const overviewLook = new THREE.Vector3();
	const readingPos = new THREE.Vector3();
	const readingLook = new THREE.Vector3();
	const camPos = new THREE.Vector3();
	const camLook = new THREE.Vector3();
	let targetTiltX = 0;
	let targetTiltY = 0;
	let currentTiltX = 0;
	let currentTiltY = 0;

	const raycaster = new THREE.Raycaster();
	const mousePos = new THREE.Vector2();

	/* ---------------- Painting ---------------- */

	let lastHoverId: string | null = null;
	let lastLayoutProgress = -1;
	let lastRegionIndex = -1;
	let regionsDirty = true;
	let openAnimation: { from: number; to: number; started: number } | null = null;

	/** Physical pixel scale a sheet should be painted at for its distance. */
	function tierFor(index: number): number {
		return Math.abs(index - bookStore.currentPageIndex) <= 1 ? PAGE_TEX_SCALE : 1;
	}

	/** Paints (or repaints) one sheet's texture and records its hit regions. */
	function paintSheet(state: SheetState, index: number, physicalScale: number): void {
		if (!grain) return;
		const page = pages[index];
		if (!page) return;

		state.canvas.width = PAGE_TEX_WIDTH * physicalScale;
		state.canvas.height = PAGE_TEX_HEIGHT * physicalScale;

		const paintState: PagePaintState = {
			page,
			pages,
			index,
			hoverId: bookStore.hoverRegionId,
			selectedOptionId: bookStore.selectedOptions[page.id] ?? null,
			meta: bookMeta,
			copy: bookUiCopy
		};
		state.regions = paintPage(state.ctx, paintState, grain);
		state.texture.needsUpdate = true;
		state.paintedScale = physicalScale;
		state.gpuLive = true;
	}

	/**
	 * Brings every sheet to its tier in idle time, two per slice. Upgrades land
	 * before a sheet is ever shown (posing paints synchronously first), so this
	 * pump never blocks a turn landing and the finish stays hitch-free.
	 */
	function pumpTiers() {
		const current = bookStore.currentPageIndex;
		const pending = sheets
			.map((state, i) => ({ i, want: tierFor(i), painted: state.paintedScale }))
			.filter(({ i, want, painted }) => painted !== want && Math.abs(i - current) <= 6)
			.sort(
				(a, b) =>
					Math.abs(a.i - bookStore.currentPageIndex) - Math.abs(b.i - bookStore.currentPageIndex)
			);

		const pump = () => {
			if (idleCancelled) return;
			for (let n = 0; n < 2 && pending.length > 0; n++) {
				const next = pending.shift();
				if (!next) break;
				// The reading position may have moved while idling; re-check.
				if (sheets[next.i].paintedScale === tierFor(next.i)) continue;
				paintSheet(sheets[next.i], next.i, tierFor(next.i));
			}
			if (pending.length > 0) {
				if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(pump);
				else setTimeout(pump, 0);
			} else {
				regionsDirty = true;
			}
		};

		if (pending.length === 0) return;
		if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(pump);
		else setTimeout(pump, 0);
	}

	/** Frees GPU memory for sheets far from the reading position. */
	function ensureResidency() {
		const current = bookStore.currentPageIndex;
		for (let i = 0; i < sheets.length; i++) {
			const state = sheets[i];
			if (state.paintedScale === 0) continue;
			if (Math.abs(i - current) > GPU_DEPTH) {
				if (state.gpuLive) {
					state.texture.dispose();
					state.gpuLive = false;
				}
			} else if (!state.gpuLive) {
				state.texture.needsUpdate = true;
				state.gpuLive = true;
			}
		}
	}

	/**
	 * Projects the current page's controls onto the viewport. Only the top
	 * sheet of the right pile carries live buttons.
	 */
	function refreshRegions() {
		if (!containerEl || !camera) return;
		const current = sheets[bookStore.currentPageIndex];

		rectoRegions =
			current && current.paintedScale > 0 && openProgress > 0.4
				? projectHitRegions(current.regions, {
						outerEdgeX: 0,
						surfaceY: PAGE_BASE_Y,
						scaleX: 1,
						camera,
						containerWidth: containerEl.clientWidth,
						containerHeight: containerEl.clientHeight
					})
				: [];

		lastRegionIndex = bookStore.currentPageIndex;
		regionsDirty = false;
	}

	/* ---------------- Sheet motion ---------------- */

	const smootherstep = (t: number): number => {
		const x = Math.min(Math.max(t, 0), 1);
		return x * x * x * (x * (x * 6 - 15) + 10);
	};

	interface Flight {
		index: number;
		forward: boolean;
		y0: number;
		y1: number;
	}

	/**
	 * The sheet currently in the air, if any. Multi-page jumps restack
	 * instantly instead of flying a single sheet across the book.
	 */
	function flightFor(): Flight | null {
		if (!bookStore.isFlipping || bookStore.flipTargetIndex === null) return null;
		const current = bookStore.currentPageIndex;
		const target = bookStore.flipTargetIndex;
		if (Math.abs(target - current) !== 1) return null;

		const forward = target > current;
		if (forward) {
			return {
				index: current,
				forward: true,
				y0: RIGHT_TOP_Y,
				y1: LEFT_BASE_Y + current * STACK_GAP_LEFT
			};
		}
		return {
			index: target,
			forward: false,
			// Same bottom-anchored height the sheet already rests at: liftoff
			// must not teleport it first.
			y0: LEFT_BASE_Y + target * STACK_GAP_LEFT,
			// Touch down just above the pile top instead of exactly on it:
			// the resting pose settles the final step imperceptibly, and the
			// sheet never goes coplanar with the page beneath it.
			y1: RIGHT_TOP_Y + 0.004
		};
	}

	function poseResting(state: SheetState, index: number, current: number) {
		const placement = placeSheet(index, current, pages.length);

		let y: number;
		let tilt: number;
		if (placement.side === 'right') {
			// When the book is closed, the right pile sits on the block
			// (inside the cover). Once the cover opens past ~15%, the pile
			// lifts to the reading plane.
			const closedY = BLOCK_TOP + PAGE_GAP;
			const readingY = RIGHT_TOP_Y;
			y = THREE.MathUtils.lerp(closedY, readingY, openProgress);
			tilt = 0;
		} else {
			// The finished pile grows upward from a fixed base, like a real
			// book: landing a sheet on top never moves the ones below it, so
			// there is no jump or sink-through at the handoff.
			y = LEFT_BASE_Y + index * STACK_GAP_LEFT;
			tilt = LEFT_TILT;
		}

		// While the book is closed the whole right pile is rendered so the
		// sheets are really inside the cover; the cover then hides them. Once
		// it opens only the top sheet shows: the unread sheets sit *under* it,
		// and keeping them on screen would stack every sheet on the same plane.
		const show =
			placement.side === 'right'
				? placement.depth === 0 || openProgress <= 0.03
				: openProgress > COVER_FLAT_PROGRESS && placement.depth <= VISIBLE_DEPTH;
		if (show && state.paintedScale === 0) {
			// The idle prefetch may not have reached this sheet yet (or the tab
			// starved it); paint now so it is never shown blank.
			paintSheet(state, index, tierFor(index));
		}

		// Bend and tilt snap discretely; height is fixed at the computed value.
		// No gliding - only the actively turning page should move.
		const key = `${placement.side}:${tilt.toFixed(4)}`;
		if (key !== state.lastPoseKey) {
			applyTurnPose(state.sheet, {
				hingeAngle: placement.side === 'right' ? 0 : Math.PI,
				curl: 0,
				curlSign: 1,
				bow: 0,
				profile: TURNING_PROFILE,
				profileWeight: 1
			});
			state.mesh.rotation.z = tilt;
			state.lastPoseKey = key;
		}

		// Fixed position - no gliding. Only the actively turning page moves.
		state.mesh.position.y = y;
		state.mesh.visible = show;
		// Update renderOrder when pile index changes.
		const newOrder =
			placement.side === 'right'
				? 100 - Math.min(placement.depth, 50)
				: 50 - Math.min(placement.depth, 50);
		if (state.mesh.renderOrder !== newOrder) {
			state.mesh.renderOrder = newOrder;
		}
	}

	/** Above every resting sheet (0-100), so the sheet in the air always wins. */
	const FLYING_RENDER_ORDER = 1000;

	function poseFlying(state: SheetState, flight: Flight) {
		const progress = bookStore.flipProgress;
		const lift = Math.sin(Math.PI * progress);
		const q = flight.forward ? progress : 1 - progress;

		applyTurnPose(state.sheet, {
			hingeAngle: Math.PI * progress,
			curl: 1.15 * lift,
			curlSign: flight.forward ? 1 : -1,
			bow: 0.03 * lift,
			profile: TURNING_PROFILE,
			profileWeight: 1 - 0.5 * lift
		});
		state.mesh.position.y = flight.y0 + (flight.y1 - flight.y0) * smootherstep(q) + lift * 0.12;
		// The tilt blends across the whole flight, in step with the height, so
		// the sheet stays parallel to the pile it is settling onto and never
		// slices through the page beneath it on the way down.
		state.mesh.rotation.z = flight.forward
			? LEFT_TILT * smootherstep(q)
			: LEFT_TILT * (1 - smootherstep(q));
		// The flying sheet has to outrank every resting sheet. It starts flush
		// on the reading plane (forward turn) and lands flush on it (backward
		// turn), so for that frame it shares the plane with the sheet it is
		// uncovering. Equal depth plus equal renderOrder would let the sheet
		// *behind* win the tie and flash through for a frame.
		state.mesh.renderOrder = FLYING_RENDER_ORDER;
		state.mesh.visible = openProgress > 0.03;
		state.lastPoseKey = `flying:${progress.toFixed(4)}`;
	}

	/* ---------------- Interaction ---------------- */

	function openBook() {
		if (bookStore.bookUIState === 'closed') bookStore.openBook();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!containerEl || !camera) return;
		const rect = containerEl.getBoundingClientRect();
		mousePos.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mousePos.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

		if (bookStore.bookUIState === 'closed') {
			targetTiltY = mousePos.x * 0.22;
			targetTiltX = -mousePos.y * 0.14;
			if (scene && camera) {
				raycaster.setFromCamera(mousePos, camera);
				const targets = [coverMeshRef, blockMeshRef].filter((m) => m !== null);
				isHoveringCover =
					targets.length > 0 && raycaster.intersectObjects(targets, false).length > 0;
			}
		} else {
			targetTiltX = 0;
			targetTiltY = 0;
			isHoveringCover = false;
		}
	}

	let swipeStartX: number | null = null;

	function handlePointerDown(event: PointerEvent) {
		if ((event.target as HTMLElement).closest('button')) return;
		swipeStartX = event.clientX;
	}

	function handlePointerUp(event: PointerEvent) {
		if (swipeStartX === null) return;
		const delta = event.clientX - swipeStartX;
		swipeStartX = null;
		if (Math.abs(delta) < 48 || !bookStore.isBookOpen) return;
		if (delta < 0) bookStore.nextPage();
		else bookStore.prevPage();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (bookStore.isTableOfContentsOpen) return;

		if (!bookStore.isBookOpen) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				openBook();
			}
			return;
		}

		if (event.key === 'ArrowRight' || event.key === 'PageDown') {
			event.preventDefault();
			bookStore.nextPage();
		} else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
			event.preventDefault();
			bookStore.prevPage();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			bookStore.closeBook();
		}
	}

	/* ---------------- Book construction ---------------- */

	/** Shape of the resting paper surface, reused by the pages and the block. */
	function surfaceOffsetAt(u: number): number {
		return (
			-RESTING_PROFILE.gutterDepth * Math.pow(1 - u, 2.2) +
			RESTING_PROFILE.archHeight * Math.sin(Math.PI * u)
		);
	}

	/** Builds the desk, the boards, the block and the hinged cover. */
	function buildBook(): void {
		if (!scene) return;

		const woodMat = new THREE.MeshStandardMaterial({
			map: createWoodDeskTexture(),
			roughness: 0.55,
			metalness: 0.05
		});
		const desk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 12), woodMat);
		desk.position.set(0, -0.22, 0);
		desk.receiveShadow = true;
		scene.add(desk);

		const blotterMat = new THREE.MeshStandardMaterial({
			map: createDeskPadTexture(),
			roughness: 0.75,
			metalness: 0.08
		});
		const blotter = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.02, 5.8), blotterMat);
		blotter.position.set(0, -0.008, 0);
		blotter.receiveShadow = true;
		scene.add(blotter);

		const linenMat = new THREE.MeshStandardMaterial({
			color: 0x1a1c21,
			roughness: 0.65,
			metalness: 0.1
		});
		const boardGeo = new THREE.BoxGeometry(
			PAGE_WIDTH + COVER_OVERHANG,
			BOARD_THICKNESS,
			PAGE_HEIGHT + COVER_OVERHANG
		);

		// Back board, under the text block.
		const backBoard = new THREE.Mesh(boardGeo, linenMat);
		backBoard.position.set((PAGE_WIDTH + COVER_OVERHANG) / 2, BOARD_THICKNESS / 2, 0);
		backBoard.castShadow = true;
		backBoard.receiveShadow = true;
		scene.add(backBoard);

		// Text block, with its top surface curved to follow the gutter.
		const blockGeo = new THREE.BoxGeometry(PAGE_WIDTH, BLOCK_THICKNESS, PAGE_HEIGHT, 24, 1, 1);
		blockGeo.translate(PAGE_WIDTH / 2, 0, 0);
		const blockPos = blockGeo.getAttribute('position') as THREE.BufferAttribute;
		const blockArr = blockPos.array as Float32Array;
		for (let i = 0; i < blockArr.length; i += 3) {
			if (blockArr[i + 1] <= 0) continue;
			const u = blockArr[i] / PAGE_WIDTH;
			blockArr[i + 1] += surfaceOffsetAt(Math.min(Math.max(u, 0), 1));
		}
		blockPos.needsUpdate = true;
		blockGeo.computeVertexNormals();

		const blockSideMat = new THREE.MeshStandardMaterial({
			map: createPageBlockTexture(),
			roughness: 0.85
		});
		const paperMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.95 });
		// BoxGeometry has six material groups: +X, -X, +Y, -Y, +Z, -Z.
		const block = new THREE.Mesh(blockGeo, [
			blockSideMat,
			paperMat,
			paperMat,
			blockSideMat,
			blockSideMat,
			blockSideMat
		]);
		block.position.set(0, BOARD_THICKNESS + BLOCK_THICKNESS / 2, 0);
		block.castShadow = true;
		block.receiveShadow = true;
		scene.add(block);
		blockMeshRef = block;

		// Front cover, hinged on the spine.
		coverHinge = new THREE.Group();
		coverHinge.position.set(0, BLOCK_TOP, 0);
		scene.add(coverHinge);

		const coverGeo = new THREE.BoxGeometry(
			PAGE_WIDTH + COVER_OVERHANG,
			COVER_THICKNESS,
			PAGE_HEIGHT + COVER_OVERHANG,
			20,
			1,
			1
		);
		coverGeo.translate((PAGE_WIDTH + COVER_OVERHANG) / 2, 0, 0);
		// The cover stays a clean flat board: the page's own gutter curve is
		// what settles into the block, in both the closed and open states.
		coverGeo.computeVertexNormals();

		const foilMat = new THREE.MeshStandardMaterial({
			map: createBookCoverTexture(bookMeta),
			roughness: 0.45,
			metalness: 0.25
		});
		const endpaperMat = new THREE.MeshStandardMaterial({ color: 0xf8f5ee, roughness: 0.9 });
		const coverMesh = new THREE.Mesh(coverGeo, [
			linenMat,
			linenMat,
			foilMat,
			endpaperMat,
			linenMat,
			linenMat
		]);
		coverMesh.position.y = COVER_THICKNESS / 2;
		coverMesh.castShadow = true;
		coverMesh.receiveShadow = true;
		coverHinge.add(coverMesh);
		coverMeshRef = coverMesh;
	}

	/** Single shared texture for every sheet back: the book's static mark. */
	function makeStaticBackTexture(maxAniso: number): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = PAGE_TEX_WIDTH * PAGE_TEX_SCALE;
		canvas.height = PAGE_TEX_HEIGHT * PAGE_TEX_SCALE;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2D canvas unavailable');
		paintStaticBack(ctx, grain, bookMeta);
		backCanvas = canvas;
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = maxAniso;
		texture.generateMipmaps = true;
		texture.minFilter = THREE.LinearMipmapLinearFilter;
		texture.magFilter = THREE.LinearFilter;
		return texture;
	}

	/** Builds one permanent sheet per page; the current one paints immediately. */
	function buildPages(): void {
		if (!scene || !renderer) return;
		const activeScene = scene;

		const paperEdgeMat = new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.95 });

		const maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());

		sheets = [];

		// Compute current page index upfront so it's available for sheet initialization.
		const current = Math.min(bookStore.currentPageIndex, pages.length - 1);

		for (let index = 0; index < pages.length; index++) {
			const sheet = createPageSheet('right');
			applyRestProfile(sheet, RESTING_PROFILE);

			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('2D canvas unavailable');

			const texture = new THREE.CanvasTexture(canvas);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = maxAniso;
			texture.generateMipmaps = true;
			texture.minFilter = THREE.LinearMipmapLinearFilter;
			texture.magFilter = THREE.LinearFilter;

			// `toneMapped: false` keeps the baked type contrasty under the warm
			// studio lighting instead of letting ACES wash it out.
			// Self-lit texture keeps the ink readable when the sheet curls
			// edge-on to the key light mid-turn. With physical lighting the
			// diffuse response is dim on sideways normals, so without this the
			// flying sheet falls back to flat gray. Because it is multiplied
			// by the map itself, blacks stay black and only paper lifts.
			const faceMat = new THREE.MeshStandardMaterial({
				map: texture,
				emissive: 0xffffff,
				emissiveMap: texture,
				emissiveIntensity: 0.45,
				roughness: 0.93,
				toneMapped: false
			});
			if (!backMatShared) {
				const backTexture = makeStaticBackTexture(maxAniso);
				backMatShared = new THREE.MeshStandardMaterial({
					map: backTexture,
					emissive: 0xffffff,
					emissiveMap: backTexture,
					emissiveIntensity: 0.45,
					roughness: 0.93,
					toneMapped: false
				});
			}

			// Front: this page. Back: the shared static design, read through
			// mirrored UVs (which lands it the right way up on the left pile).
			const mesh = new THREE.Mesh(sheet.geometry, [faceMat, backMatShared, paperEdgeMat]);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			// Place at the correct closed-book position immediately so the first
			// frame never shows the sheet at the table level (y=0).
			const placement = placeSheet(index, current, pages.length);
			const closedY =
				placement.side === 'right' ? BLOCK_TOP + PAGE_GAP : LEFT_BASE_Y + index * STACK_GAP_LEFT;
			const closedTilt = placement.side === 'right' ? 0 : LEFT_TILT;
			mesh.position.set(0, closedY, 0);
			mesh.rotation.z = closedTilt;
			mesh.visible = false;
			// renderOrder: right pile (unread) = high to low from top to bottom;
			// left pile (read) = low to high from top to bottom.
			// Current page (depth 0 on right) gets highest renderOrder.
			const renderOrder =
				placement.side === 'right'
					? 100 - Math.min(placement.depth, 50)
					: 50 - Math.min(placement.depth, 50);
			mesh.renderOrder = renderOrder;
			activeScene.add(mesh);

			sheets.push({
				sheet,
				mesh,
				canvas,
				ctx,
				texture,
				regions: [],
				paintedScale: 0,
				gpuLive: true,
				lastPoseKey: ''
			});
		}

		// The reading page paints synchronously so the first frame is complete;
		// everything else follows in idle time.
		if (sheets[current]) {
			paintSheet(sheets[current], current, PAGE_TEX_SCALE);
		}
		if (sheets[current + 1]) {
			paintSheet(sheets[current + 1], current + 1, PAGE_TEX_SCALE);
		}
		pumpTiers();

		// Set initial poses so sheets don't pop from y=0 when they first become visible.
		for (let i = 0; i < sheets.length; i++) {
			poseResting(sheets[i], i, current);
		}
	}

	/** Picks camera framings that always fit the current viewport. */
	function updateCameraTargets(): void {
		if (!camera || !containerEl) return;
		const aspect = containerEl.clientWidth / Math.max(containerEl.clientHeight, 1);
		const halfV = Math.tan((camera.fov * Math.PI) / 360);

		const distance = (halfWidth: number, halfDepth: number, tilt: number) =>
			Math.max(halfWidth / (halfV * aspect), (halfDepth * Math.cos(tilt)) / halfV) * 1.06;

		// Reading view looks straight down on the single right page. Height is the
		// primary framing constraint, so the sheet spans the viewport from edge to
		// edge on any screen wide enough to allow it, and solving it without the
		// margin the `distance` helper adds keeps its type one size across those
		// screens. The width term is the mobile guard: a phone is far narrower
		// than the page is tall, so filling the height there would slice the text
		// off at both sides. Taking the larger distance instead fits the whole
		// sheet, and the page's own aspect ratio is where the two swap over.
		const readX = PAGE_WIDTH / 2;
		const readDist = Math.max(PAGE_HEIGHT / (2 * halfV), PAGE_WIDTH / (2 * halfV * aspect));
		readingPos.set(readX, PAGE_BASE_Y + readDist, 0);
		readingLook.set(readX, PAGE_BASE_Y, 0);

		const viewTilt = 0.9;
		const viewCenter = PAGE_WIDTH / 2;
		// The near edge of the book is much closer to the camera than its
		// centre, so the overview needs extra breathing room.
		const viewDist = distance((PAGE_WIDTH + COVER_OVERHANG) / 2 + 0.6, 2.55, viewTilt) * 1.15;
		overviewPos.set(viewCenter, viewDist * Math.cos(viewTilt), viewDist * Math.sin(viewTilt));
		overviewLook.set(viewCenter, 0.16, 0);
	}

	function syncCamera(): void {
		if (!camera) return;
		camPos.lerpVectors(overviewPos, readingPos, openProgress);
		camLook.lerpVectors(overviewLook, readingLook, openProgress);

		const parallax = 1 - openProgress;
		camera.position.set(
			camPos.x + currentTiltY * parallax * 0.8,
			camPos.y + currentTiltX * parallax * 0.6,
			camPos.z
		);
		// Looking straight down leaves the world up parallel to the view axis, so
		// `lookAt` would have to invent a roll. Roll explicitly instead: from the
		// world's up while the book is closed to the page's own -Z axis once it is
		// open, which keeps the page's top edge at the top of the screen. The
		// dolly never points the camera along that blended axis before arriving.
		camera.up.set(0, 1 - openProgress, -openProgress).normalize();
		camera.lookAt(camLook);
	}

	/* ---------------- Lifecycle ---------------- */

	function initScene() {
		if (!containerEl || !canvasEl) return;

		const width = containerEl.clientWidth;
		const height = containerEl.clientHeight;

		scene = new THREE.Scene();
		scene.background = new THREE.Color('#EAE6DF');

		camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
		camera.position.set(0, 3.4, 2.6);
		camera.lookAt(0, 0, 0);

		renderer = new THREE.WebGLRenderer({
			canvas: canvasEl,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.08;
		renderer.setSize(width, height);

		grain = createPaperGrain(document.createElement('canvas').getContext('2d'));

		// Studio lighting for the reading desk.
		scene.add(new THREE.AmbientLight(0xfff6ea, 1.55));

		const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.3);
		keyLight.position.set(4.5, 8, 5);
		keyLight.castShadow = true;
		keyLight.shadow.mapSize.set(2048, 2048);
		keyLight.shadow.camera.near = 0.5;
		keyLight.shadow.camera.far = 24;
		keyLight.shadow.camera.left = -6;
		keyLight.shadow.camera.right = 6;
		keyLight.shadow.camera.top = 6;
		keyLight.shadow.camera.bottom = -6;
		keyLight.shadow.bias = -0.0002;
		scene.add(keyLight);

		const fillLight = new THREE.DirectionalLight(0xe8eef8, 0.75);
		fillLight.position.set(-6, 4, 3);
		scene.add(fillLight);

		buildBook();
		buildPages();
		updateCameraTargets();
	}

	function startLoop() {
		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			if (!renderer || !scene || !camera) return;

			stepOpenAnimation();

			// Cover hinge.
			if (coverHinge) coverHinge.rotation.z = COVER_OPEN_ANGLE * openProgress;

			currentTiltX += (targetTiltX - currentTiltX) * 0.05;
			currentTiltY += (targetTiltY - currentTiltY) * 0.05;
			syncCamera();

			// Sheets: one flies while the rest hold their piles.
			const flight = flightFor();
			if (flight && sheets[flight.index].paintedScale === 0) {
				// The reader turned faster than the idle painter; paint now so
				// the sheet is never caught blank mid-flight.
				paintSheet(sheets[flight.index], flight.index, PAGE_TEX_SCALE);
			}
			const current = bookStore.currentPageIndex;
			// During a turn, pose the resting piles for the TARGET page so the
			// incoming page is already at depth 0 (visible) in the right pile.
			// Works for both forward and backward turns.
			const target = bookStore.flipTargetIndex ?? current;
			// Forward: the sheet lifting off is the current one, so the piles must
			// already be stacked for the target or the reading plane goes empty
			// mid-flight. Backward: the sheet in the air comes from the left pile
			// and lands *on top of* the current page, which has to stay put.
			const poseFor = flight ? (flight.forward ? target : current) : current;
			for (let i = 0; i < sheets.length; i++) {
				if (flight && i === flight.index) poseFlying(sheets[i], flight);
				else poseResting(sheets[i], i, poseFor);
			}

			// Repaint when the pointer moves between page controls.
			if (bookStore.hoverRegionId !== lastHoverId) {
				lastHoverId = bookStore.hoverRegionId;
				const active = sheets[bookStore.currentPageIndex];
				if (active && active.paintedScale > 0) {
					paintSheet(active, bookStore.currentPageIndex, active.paintedScale);
				}
				regionsDirty = true;
			}

			// The committed page changed (a turn just landed): upgrade the new
			// neighbours to full resolution and release the distant ones.
			if (lastRegionIndex !== bookStore.currentPageIndex && !bookStore.isFlipping) {
				pumpTiers();
			}

			// Re-project the controls when the page, the paint or the camera
			// framing changed; the loop stays idle while simply reading.
			if (
				regionsDirty ||
				lastRegionIndex !== bookStore.currentPageIndex ||
				openProgress !== lastLayoutProgress
			) {
				lastLayoutProgress = openProgress;
				ensureResidency();
				refreshRegions();
			}

			renderer.render(scene, camera);
		};

		animate();
	}

	/* ---------------- Animation ---------------- */

	const OPEN_DURATION = 900;

	function cubicEaseOut(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	/**
	 * Owns the cover / camera open-close transition. It is polled from the
	 * render loop instead of an effect, so `openProgress` is only ever written
	 * from a single animation frame.
	 */
	function stepOpenAnimation() {
		const state = bookStore.bookUIState;

		if (!openAnimation) {
			if (state === 'opened') openProgress = 1;
			else if (state === 'closed') openProgress = 0;
			else if (state === 'opening' || state === 'closing') {
				openAnimation = {
					from: openProgress,
					to: state === 'opening' ? 1 : 0,
					started: performance.now()
				};
			}
		}

		if (!openAnimation) return;
		const linear = Math.min(1, (performance.now() - openAnimation.started) / OPEN_DURATION);
		openProgress =
			openAnimation.from + (openAnimation.to - openAnimation.from) * cubicEaseOut(linear);
		if (linear >= 1) {
			openProgress = openAnimation.to;
			openAnimation = null;
		}
	}

	function handleResize() {
		if (!containerEl || !renderer || !camera) return;
		const width = containerEl.clientWidth;
		const height = containerEl.clientHeight;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		updateCameraTargets();
		regionsDirty = true;
	}

	// Re-bake the affected textures whenever an answer is recorded.
	$effect(() => {
		const answers = bookStore.selectedOptions;
		void answers;
		const index = bookStore.currentPageIndex;
		const active = sheets[index];
		if (active && active.paintedScale > 0 && grain) {
			const pageId = pages[index]?.id;
			if (pageId && answers[pageId] !== undefined) {
				paintSheet(active, index, active.paintedScale);
				regionsDirty = true;
			}
		}
	});

	// The store needs the page list for navigation bounds and per-page answers.
	$effect(() => {
		bookStore.registerPages(pages);
	});

	onMount(() => {
		initScene();
		if (!renderer) return;

		const handleKey = handleKeyDown;
		window.addEventListener('keydown', handleKey);
		window.addEventListener('resize', handleResize);
		startLoop();

		// The painter needs the web fonts before the first bake.
		void ensurePageFonts().then(() => {
			for (let i = 0; i < sheets.length; i++) {
				if (sheets[i].paintedScale > 0) {
					paintSheet(sheets[i], i, sheets[i].paintedScale);
				}
			}
			if (backCanvas && backMatShared?.map) {
				const ctx = backCanvas.getContext('2d');
				if (ctx) {
					paintStaticBack(ctx, grain, bookMeta);
					backMatShared.map.needsUpdate = true;
				}
			}
			regionsDirty = true;
		});

		return () => {
			idleCancelled = true;
			window.removeEventListener('keydown', handleKey);
			window.removeEventListener('resize', handleResize);
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
			renderer?.dispose();
			scene?.traverse((object) => {
				const mesh = object as THREE.Mesh;
				mesh.geometry?.dispose?.();
				const material = mesh.material;
				if (Array.isArray(material)) material.forEach((m) => m.dispose());
				else material?.dispose?.();
			});
			for (const state of sheets) state.texture.dispose();
			sheets = [];
		};
	});
</script>

<div
	bind:this={containerEl}
	class="relative h-[100dvh] h-screen w-full overflow-hidden bg-[#EAE6DF] select-none"
	class:cursor-pointer={isHoveringCover && bookStore.bookUIState === 'closed'}
	onpointermove={handlePointerMove}
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	role="region"
	aria-label={fillCopy(bookUiCopy.experience.regionLabel, { title: bookMeta.title })}
>
	<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full"></canvas>

	<!-- Real, focusable controls projected onto the single reading page. -->
	<div class="pointer-events-none absolute inset-0 z-30">
		<PageInteractionLayer regions={rectoRegions} interactive={overlayActive} />
	</div>

	{#if openProgress < 0.85}
		<div
			class="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-8 transition-opacity duration-300 sm:p-12 {openProgress >
			0.1
				? 'opacity-0'
				: 'opacity-100'}"
		>
			<div class="pointer-events-auto flex flex-col items-center space-y-3">
				<button
					type="button"
					onclick={openBook}
					class="group flex cursor-pointer items-center gap-3 rounded-full border border-amber-500/50 bg-[#1E2229] px-8 py-3.5 text-stone-100 shadow-2xl transition-all duration-300 hover:scale-105 hover:border-amber-400 hover:bg-[#14171C] active:scale-95"
					aria-label={bookUiCopy.experience.openButtonLabel}
				>
					<span class="font-serif text-sm font-medium tracking-wide"
						>{bookUiCopy.experience.openLabel}</span
					>
					<svg
						class="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-0.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
				</button>
				<p
					class="rounded-full bg-white/70 px-3 py-1 font-sans text-[11px] text-stone-600 shadow-2xs backdrop-blur-xs"
				>
					{bookUiCopy.experience.openHint}
				</p>
			</div>
		</div>
	{/if}

	{#if bookStore.bookUIState === 'closed'}
		<button
			type="button"
			onclick={openBook}
			class="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent focus:outline-none"
			aria-label={bookUiCopy.experience.clickToOpenLabel}
		></button>
	{/if}
</div>
