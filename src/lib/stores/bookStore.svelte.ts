import {
	playPaperFlipSound,
	playSoftClickSound,
	playBookOpenSound,
	playBookCloseSound
} from '../audio/sfx';
import type { BookUIState, FlipDirection, PageSide, ViewMode } from '../types/book';

/**
 * Reading position and book state for the top-down 2D book.
 *
 * The position is a spread plus a side: `spreadIndex` is the open two-page
 * spread (0-based), `side` refines it for the mobile single-page view. The
 * committed position only changes when a turn or slide *finishes* (the scene
 * calls {@link BookStore.completeTransition} on animation end); while a
 * transition runs the target lives in `pending`.
 *
 * Transitions are CSS-driven, so the store keeps no per-frame progress:
 * flip/slide semantics live in the components, here we own position, input
 * gating, SFX and persistence.
 */

const OPEN_DURATION = 850;
/**
 * Safety net for the turn/slide commit. The animation (340ms slide,
 * 700ms leaf) is longer than this only if the browser refuses to run
 * it (hidden tab, node unmounted mid-turn). If the transitionend
 * never arrives, the position is committed anyway so navigation can
 * never deadlock with the buttons stuck disabled.
 */
const FLIP_SAFETY_MS = 950;

const POSITION_KEY = 'plateia_position';
/** Pre-refactor key, read once to migrate the last-read page. */
const LEGACY_PAGE_KEY = 'plateia_page_index';

export class BookStore {
	/* ---------------- Position ---------------- */

	spreadIndex = $state<number>(0);
	side = $state<PageSide>('left');

	/* ---------------- View ---------------- */

	/** Track of viewport width; only changes while the book is idle. */
	mode = $state<ViewMode>('spread');
	/** 'closed' | 'opening' | 'opened' | 'closing' (cover transitions). */
	bookUIState = $state<BookUIState>('closed');
	isFlipping = $state<boolean>(false);
	flipDirection = $state<FlipDirection>('next');
	/** Position the in-flight turn/slide is heading to; null when idle. */
	pending = $state<{ spreadIndex: number; side: PageSide } | null>(null);

	/* ---------------- Content & prefs ---------------- */

	totalPages = $state<number>(0);
	audioEnabled = $state<boolean>(true);
	isTableOfContentsOpen = $state<boolean>(false);
	/** Interactive answers, keyed by page id. */
	selectedOptions = $state<Record<string, string>>({});

	private pageIds: string[] = [];

	/* ---------------- Derived ---------------- */

	totalSpreads = $derived(Math.ceil(this.totalPages / 2));

	isBookOpen = $derived(this.bookUIState === 'opened');

	/** 0-based index of the page shown on the mobile side (or the spread's left page). */
	pageIndexOfSide = $derived(this.spreadIndex * 2 + (this.side === 'right' ? 1 : 0));

	/**
	 * Reading progress for the bar: per page in single mode, per spread in
	 * spread mode (the whole spread counts as one step on desktop).
	 */
	progressPercent = $derived.by(() => {
		if (this.mode === 'single') {
			return this.totalPages > 1
				? Math.round((this.pageIndexOfSide / (this.totalPages - 1)) * 100)
				: 0;
		}
		return this.totalSpreads > 1
			? Math.round((this.spreadIndex / (this.totalSpreads - 1)) * 100)
			: 0;
	});

	canGoPrev = $derived(this.isBookOpen && !this.isFlipping && this.previousPosition() !== null);
	canGoNext = $derived(this.isBookOpen && !this.isFlipping && this.nextPosition() !== null);

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
				} else {
					// Migrate the pre-refactor single-page position.
					const legacy = localStorage.getItem(LEGACY_PAGE_KEY);
					if (legacy !== null) {
						const parsed = parseInt(legacy, 10);
						if (!isNaN(parsed) && parsed >= 0) {
							this.spreadIndex = Math.floor(parsed / 2);
							this.side = parsed % 2 === 1 ? 'right' : 'left';
						}
					}
				}
				const savedAudio = localStorage.getItem('plateia_audio_enabled');
				if (savedAudio !== null) {
					this.audioEnabled = savedAudio === 'true';
				}
				const savedOptions = localStorage.getItem('plateia_selected_options');
				if (savedOptions !== null) {
					const parsed = JSON.parse(savedOptions) as Record<string, string>;
					if (parsed && typeof parsed === 'object') {
						this.selectedOptions = parsed;
					}
				}
			} catch {
				// Local storage might not be accessible
			}
		}
	}

	/* ---------------- Content registration ---------------- */

	registerPages(pages: { id: string }[]) {
		this.pageIds = pages.map((page) => page.id);
		this.totalPages = pages.length;
		const last = Math.max(this.totalSpreads - 1, 0);
		if (this.spreadIndex > last) {
			this.spreadIndex = last;
		}
	}

	/* ---------------- View mode ---------------- */

	/**
	 * Switches spread/single framing. Ignored mid-transition: the
	 * in-flight animation was mounted for one framing, so the scene
	 * re-evaluates on the next (continuous) resize event once it
	 * settles. Allowed while the cover opens/closes — the open
	 * layer is animating in or out anyway.
	 */
	setMode(mode: ViewMode) {
		if (mode === this.mode) return;
		if (this.isFlipping) return;
		this.mode = mode;
	}

	/* ---------------- Book open / close ---------------- */

	openBook() {
		if (this.isBookOpen || this.bookUIState === 'opening') return;
		this.bookUIState = 'opening';

		if (this.audioEnabled) {
			playBookOpenSound();
		}

		// Matches the CSS open transition (cover sweep + dolly, ~850ms).
		setTimeout(() => {
			this.bookUIState = 'opened';
		}, OPEN_DURATION);
	}

	closeBook() {
		if (!this.isBookOpen || this.bookUIState === 'closing') return;
		this.bookUIState = 'closing';

		if (this.audioEnabled) {
			playBookCloseSound();
		}

		setTimeout(() => {
			this.bookUIState = 'closed';
		}, OPEN_DURATION);
	}

	/* ---------------- Navigation ---------------- */

	/**
	 * One step forward in reading order for the current view mode.
	 * Steps arriving mid-transition are ignored — the in-flight move
	 * is still what the reader asked for, and re-targeting it would
	 * race the running animation.
	 */
	next() {
		if (this.bookUIState !== 'opened' || this.isFlipping) return;
		const target = this.nextPosition();
		if (!target) return;
		this.beginTransition(target, 'next');
	}

	/** One step back in reading order for the current view mode. */
	prev() {
		if (this.bookUIState !== 'opened' || this.isFlipping) return;
		const target = this.previousPosition();
		if (!target) return;
		this.beginTransition(target, 'prev');
	}

	/**
	 * Jumps to the spread containing `pageIndex` (0-based); in single mode it
	 * also lands on that page's side. Far jumps animate as one leaf.
	 */
	goToPage(pageIndex: number) {
		if (this.isFlipping || this.bookUIState !== 'opened') return;
		if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= this.totalPages) return;

		const spread = Math.floor(pageIndex / 2);
		const side: PageSide = pageIndex % 2 === 0 ? 'left' : 'right';
		const target = { spreadIndex: spread, side };

		const unchanged = spread === this.spreadIndex && (this.mode === 'spread' || side === this.side);
		if (unchanged) {
			this.side = side;
			return;
		}

		const direction: FlipDirection = this.isForwardJump(target, spread, side) ? 'next' : 'prev';
		this.beginTransition(target, direction);
	}

	/**
	 * Called by the scene when the turn or slide animation has finished;
	 * commits the pending position and persists it.
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

	/* ---------------- Interactive content ---------------- */

	/** Records an answer on the given page (called by in-page controls). */
	selectOptionForPage(pageId: string, optionId: string) {
		if (!this.pageIds.includes(pageId)) return;
		this.selectedOptions[pageId] = optionId;
		this.persistOptions();
		if (this.audioEnabled) {
			playSoftClickSound(0.1);
		}
	}

	/** Whether the page is currently on the reader's view (TOC highlight). */
	isPageVisible(pageIndex: number): boolean {
		if (pageIndex < 0 || pageIndex >= this.totalPages) return false;
		if (this.mode === 'single') {
			return pageIndex === this.pageIndexOfSide;
		}
		return Math.floor(pageIndex / 2) === this.spreadIndex;
	}

	/* ---------------- Audio / TOC ---------------- */

	toggleAudio() {
		this.audioEnabled = !this.audioEnabled;
		if (this.audioEnabled) {
			playSoftClickSound();
		}
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('plateia_audio_enabled', String(this.audioEnabled));
			} catch {
				// Local storage might not be accessible
			}
		}
	}

	toggleTableOfContents(open?: boolean) {
		this.isTableOfContentsOpen = open !== undefined ? open : !this.isTableOfContentsOpen;
		if (this.audioEnabled) {
			playSoftClickSound(0.08);
		}
	}

	/* ---------------- Position steps ---------------- */

	/**
	 * The position one step forward in reading order, or null at the end.
	 * Spread mode jumps whole spreads; single mode walks page by page
	 * (left → right is a slide, right → next left is a leaf).
	 */
	private nextPosition(): { spreadIndex: number; side: PageSide } | null {
		if (this.mode === 'single') {
			if (this.side === 'left') {
				return { spreadIndex: this.spreadIndex, side: 'right' };
			}
			if (this.spreadIndex >= this.totalSpreads - 1) return null;
			return { spreadIndex: this.spreadIndex + 1, side: 'left' };
		}
		if (this.spreadIndex >= this.totalSpreads - 1) return null;
		return { spreadIndex: this.spreadIndex + 1, side: 'left' };
	}

	/**
	 * The position one step back in reading order, or null at the start.
	 * The exact inverse of {@link nextPosition}.
	 */
	private previousPosition(): { spreadIndex: number; side: PageSide } | null {
		if (this.mode === 'single') {
			if (this.side === 'right') {
				return { spreadIndex: this.spreadIndex, side: 'left' };
			}
			if (this.spreadIndex === 0) return null;
			return { spreadIndex: this.spreadIndex - 1, side: 'right' };
		}
		if (this.spreadIndex === 0) return null;
		return { spreadIndex: this.spreadIndex - 1, side: 'right' };
	}

	private isForwardJump(
		target: { spreadIndex: number; side: PageSide },
		spread: number,
		side: PageSide
	): boolean {
		if (spread > this.spreadIndex) return true;
		if (spread < this.spreadIndex) return false;
		return side === 'right' && this.side === 'left';
	}

	private flipSafetyTimer: ReturnType<typeof setTimeout> | null = null;

	private beginTransition(
		target: { spreadIndex: number; side: PageSide },
		direction: FlipDirection
	) {
		this.flipDirection = direction;
		this.pending = target;
		this.isFlipping = true;

		// Rustle for a leaf crossing the spine — that only happens in
		// spread mode. The mobile view slides through the facing pages,
		// so its steps stay quiet.
		if (this.audioEnabled && this.mode === 'spread') {
			playPaperFlipSound(direction);
		}

		// The commit normally arrives via transitionend; if the browser
		// loses it (hidden tab, the node unmounting mid-move), commit
		// anyway so the controls can never stay disabled forever.
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

	private persistOptions() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem('plateia_selected_options', JSON.stringify(this.selectedOptions));
		} catch {
			// Local storage might not be accessible
		}
	}
}

export const bookStore = new BookStore();
