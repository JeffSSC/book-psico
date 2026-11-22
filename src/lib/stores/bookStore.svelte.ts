import { playPaperFlipSound } from '../audio/sfx';
import type { FlipDirection, PageSide, ViewMode } from '../types/book';

/**
 * Reading position of the HQ.
 *
 * The book is a list of sides, two per spread; a side may be empty (the
 * one beside the cover, the one beside the back cover). The position is a
 * spread plus a side: `spreadIndex` is the open spread (0-based), `side`
 * refines it for the phone's single-page view. The committed position only
 * changes when a turn *finishes* (the scene calls
 * {@link BookStore.completeTransition} on animation end); while a turn runs
 * its target lives in `pending`.
 */

/**
 * Safety net for the turn commit: if the animation end never arrives
 * (hidden tab, node unmounted mid-turn), the position is committed anyway.
 */
const FLIP_SAFETY_MS = 950;

const POSITION_KEY = 'parque_position';

interface Position {
	spreadIndex: number;
	side: PageSide;
}

export class BookStore {
	/* ---------------- Position ---------------- */

	spreadIndex = $state<number>(0);
	side = $state<PageSide>('left');

	/* ---------------- View ---------------- */

	/** Spread or single framing; only changes while the book is idle. */
	mode = $state<ViewMode>('spread');
	isFlipping = $state<boolean>(false);
	flipDirection = $state<FlipDirection>('next');
	/** Position the in-flight turn is heading to; null when idle. */
	pending = $state<Position | null>(null);

	/* ---------------- Content ---------------- */

	totalPages = $state<number>(0);
	/** Which sides hold a face; the others are empty. */
	private filled: boolean[] = [];

	/* ---------------- Derived ---------------- */

	totalSpreads = $derived(Math.ceil(this.totalPages / 2));

	/** 0-based index of the side shown on a phone (or the spread's left side). */
	pageIndexOfSide = $derived(this.spreadIndex * 2 + (this.side === 'right' ? 1 : 0));

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				const raw = localStorage.getItem(POSITION_KEY);
				if (raw !== null) {
					const pos = JSON.parse(raw) as { spread?: unknown; side?: unknown };
					if (
						typeof pos.spread === 'number' &&
						Number.isInteger(pos.spread) &&
						pos.spread >= 0 &&
						(pos.side === 'left' || pos.side === 'right')
					) {
						this.spreadIndex = pos.spread;
						this.side = pos.side;
					}
				}
			} catch {
				// Local storage might not be accessible
			}
		}
	}

	/* ---------------- Content registration ---------------- */

	/** Takes the sides of the book in order; `null` marks an empty side. */
	registerPages(sides: ({ id: string } | null)[]) {
		this.filled = sides.map((entry) => entry !== null);
		this.totalPages = sides.length;
		const last = Math.max(this.totalSpreads - 1, 0);
		if (this.spreadIndex > last) {
			this.spreadIndex = last;
		}
		this.restOnFilledSide();
	}

	/* ---------------- View mode ---------------- */

	/**
	 * Switches spread/single framing. Ignored mid-turn: the animation in
	 * flight was mounted for one framing, so the scene asks again on the
	 * next resize event once it settles.
	 */
	setMode(mode: ViewMode) {
		if (mode === this.mode) return;
		if (this.isFlipping) return;
		this.mode = mode;
		this.restOnFilledSide();
	}

	/* ---------------- Navigation ---------------- */

	/**
	 * One step forward in reading order; from the back cover the book
	 * returns to its front cover. Steps arriving mid-turn are ignored.
	 */
	next() {
		if (this.isFlipping) return;
		const target = this.stepPosition(1);
		if (target) this.beginTransition(target, 'next');
		else this.goToCover();
	}

	/** One step back in reading order; nothing lies before the cover. */
	prev() {
		if (this.isFlipping) return;
		const target = this.stepPosition(-1);
		if (target) this.beginTransition(target, 'prev');
	}

	/** Closes the book: one turn straight back to the front cover. */
	goToCover() {
		if (this.isFlipping) return;
		const cover = this.positionOf(this.filled.indexOf(true));
		if (cover.spreadIndex === this.spreadIndex) return;
		this.beginTransition(cover, 'prev');
	}

	/**
	 * Called by the scene when the turn animation has finished; commits
	 * the pending position and persists it.
	 */
	completeTransition() {
		if (!this.pending) return;
		this.clearFlipSafety();
		this.spreadIndex = this.pending.spreadIndex;
		this.side = this.pending.side;
		this.pending = null;
		this.isFlipping = false;
		this.persistPosition();
	}

	/* ---------------- Position steps ---------------- */

	private positionOf(index: number): Position {
		return { spreadIndex: Math.floor(index / 2), side: index % 2 === 0 ? 'left' : 'right' };
	}

	/** The side of a spread to rest on, preferring `side` when it is filled. */
	private restingSide(spreadIndex: number, side: PageSide): PageSide {
		const index = spreadIndex * 2 + (side === 'right' ? 1 : 0);
		if (this.filled[index]) return side;
		return side === 'left' ? 'right' : 'left';
	}

	private restOnFilledSide() {
		this.side = this.restingSide(this.spreadIndex, this.side);
	}

	/**
	 * The position `step` sides (single mode) or spreads (spread mode) away
	 * in reading order, skipping empty sides; null past either end.
	 */
	private stepPosition(step: 1 | -1): Position | null {
		if (this.mode === 'single') {
			let index = this.pageIndexOfSide + step;
			while (index >= 0 && index < this.totalPages && !this.filled[index]) index += step;
			return index >= 0 && index < this.totalPages ? this.positionOf(index) : null;
		}
		const spreadIndex = this.spreadIndex + step;
		if (spreadIndex < 0 || spreadIndex >= this.totalSpreads) return null;
		// A spread is entered from its near side: left going forward, right going back.
		return { spreadIndex, side: this.restingSide(spreadIndex, step === 1 ? 'left' : 'right') };
	}

	private flipSafetyTimer: ReturnType<typeof setTimeout> | null = null;

	private beginTransition(target: Position, direction: FlipDirection) {
		this.flipDirection = direction;
		this.pending = target;
		this.isFlipping = true;

		playPaperFlipSound(direction);

		// The commit normally arrives via transitionend; if the browser
		// loses it (hidden tab, the node unmounting mid-move), commit
		// anyway so turns can never stay blocked.
		this.clearFlipSafety();
		this.flipSafetyTimer = setTimeout(() => this.completeTransition(), FLIP_SAFETY_MS);
	}

	private clearFlipSafety() {
		if (this.flipSafetyTimer !== null) {
			clearTimeout(this.flipSafetyTimer);
			this.flipSafetyTimer = null;
		}
	}

	/* ---------------- Persistence ---------------- */

	private persistPosition() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(
				POSITION_KEY,
				JSON.stringify({ spread: this.spreadIndex, side: this.side })
			);
		} catch {
			// Local storage might not be accessible
		}
	}
}

export const bookStore = new BookStore();
