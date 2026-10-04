import {
	playPaperFlipSound,
	playSoftClickSound,
	playBookOpenSound,
	playBookCloseSound
} from '../audio/sfx';
import type { FlipDirection, BookUIState } from '../types/book';

/** Duration of the 3D page turn, in milliseconds. */
const TURN_DURATION = 820;

const easeInOutCubic = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

class BookStore {
	currentPageIndex = $state<number>(0);
	totalPages = $state<number>(0);
	isFlipping = $state<boolean>(false);
	flipDirection = $state<FlipDirection>('next');
	audioEnabled = $state<boolean>(true);
	isTableOfContentsOpen = $state<boolean>(false);

	// 3D Book Viewport States: 'closed' | 'opening' | 'opened' | 'closing'
	bookUIState = $state<BookUIState>('closed');
	isBookOpen = $state<boolean>(false);

	/** Progress of the turning sheet: 0 = right side, 1 = left side. */
	flipProgress = $state<number>(0);
	/** Page the turn is heading towards, or null when idle. */
	flipTargetIndex = $state<number | null>(null);
	/** Hit region the pointer (or keyboard focus) is currently on. */
	hoverRegionId = $state<string | null>(null);
	/** Interactive answers, keyed by page id. */
	selectedOptions = $state<Record<string, string>>({});

	// Derived state
	progressPercent = $derived(
		this.totalPages > 1 ? Math.round((this.currentPageIndex / (this.totalPages - 1)) * 100) : 0
	);

	canGoPrev = $derived(this.currentPageIndex > 0 && !this.isFlipping && this.isBookOpen);
	canGoNext = $derived(
		this.currentPageIndex < this.totalPages - 1 && !this.isFlipping && this.isBookOpen
	);

	private turnFrame: number | null = null;
	private pageIds: string[] = [];

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				const savedPage = localStorage.getItem('plateia_page_index');
				if (savedPage !== null) {
					const parsed = parseInt(savedPage, 10);
					if (!isNaN(parsed) && parsed >= 0) {
						this.currentPageIndex = parsed;
					}
				}
				const savedAudio = localStorage.getItem('plateia_audio_enabled');
				if (savedAudio !== null) {
					this.audioEnabled = savedAudio === 'true';
				}
				const savedOpen = localStorage.getItem('plateia_book_open');
				if (savedOpen === 'true') {
					this.isBookOpen = true;
					this.bookUIState = 'opened';
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

	setTotalPages(count: number) {
		this.totalPages = count;
		if (this.currentPageIndex >= count && count > 0) {
			this.currentPageIndex = count - 1;
		}
	}

	/** Registers the book contents so per-page answers can be stored by id. */
	registerPages(pages: { id: string }[]) {
		this.pageIds = pages.map((page) => page.id);
		this.setTotalPages(pages.length);
	}

	setHoverRegion(id: string | null) {
		this.hoverRegionId = id;
	}

	/** Records the answer given on the current interactive page. */
	selectOption(optionId: string) {
		const pageId = this.pageIds[this.currentPageIndex];
		if (!pageId) return;
		this.selectedOptions[pageId] = optionId;
		this.persistOptions();
		if (this.audioEnabled) {
			playSoftClickSound(0.1);
		}
	}

	openBook() {
		if (this.isBookOpen || this.bookUIState === 'opening') return;
		this.bookUIState = 'opening';

		if (this.audioEnabled) {
			playBookOpenSound();
		}

		// Animation matches cover hinge opening & camera zoom duration (~850ms)
		setTimeout(() => {
			this.isBookOpen = true;
			this.bookUIState = 'opened';
			this.persistBookOpenState();
		}, 850);
	}

	closeBook() {
		if (!this.isBookOpen || this.bookUIState === 'closing') return;
		this.bookUIState = 'closing';

		if (this.audioEnabled) {
			playBookCloseSound();
		}

		// Animation matches camera dolly-out & cover closing duration (~850ms)
		setTimeout(() => {
			this.isBookOpen = false;
			this.bookUIState = 'closed';
			this.persistBookOpenState();
		}, 850);
	}

	nextPage() {
		if (!this.canGoNext) return;
		this.turnToPage(this.currentPageIndex + 1, 'next');
	}

	prevPage() {
		if (!this.canGoPrev) return;
		this.turnToPage(this.currentPageIndex - 1, 'prev');
	}

	goToPage(targetIndex: number) {
		if (targetIndex === this.currentPageIndex || this.isFlipping) return;
		if (targetIndex < 0 || targetIndex >= this.totalPages) return;

		const dir: FlipDirection = targetIndex > this.currentPageIndex ? 'next' : 'prev';
		this.turnToPage(targetIndex, dir);
	}

	private turnToPage(targetIndex: number, direction: FlipDirection) {
		this.flipDirection = direction;
		this.isFlipping = true;
		this.flipTargetIndex = targetIndex;

		if (this.audioEnabled) {
			playPaperFlipSound(direction);
		}

		// Drive the 3D sheet from right to left on `next`, and back on `prev`.
		const from = direction === 'next' ? 0 : 1;
		const to = direction === 'next' ? 1 : 0;
		// Seed the sweep synchronously. The render loop re-registers its own
		// animation frame at the top of the frame it is drawing, so it is
		// always queued ahead of the `step` callback registered here by the
		// click: without this the first frame is drawn with the *previous*
		// turn's final progress, which teleports the sheet to its landing
		// pose for a frame and flashes the wrong side of the paper.
		this.flipProgress = from;
		const started = performance.now();
		if (this.turnFrame !== null) cancelAnimationFrame(this.turnFrame);

		const step = (now: number) => {
			const linear = Math.min(1, (now - started) / TURN_DURATION);
			this.flipProgress = from + (to - from) * easeInOutCubic(linear);

			if (linear < 1) {
				this.turnFrame = requestAnimationFrame(step);
				return;
			}

			this.turnFrame = null;
			this.flipProgress = to;
			this.currentPageIndex = targetIndex;
			this.isFlipping = false;
			this.flipTargetIndex = null;
			this.persistState();
		};

		this.turnFrame = requestAnimationFrame(step);
	}

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

	private persistState() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('plateia_page_index', String(this.currentPageIndex));
			} catch {
				// Local storage might not be accessible
			}
		}
	}

	private persistBookOpenState() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('plateia_book_open', String(this.isBookOpen));
			} catch {
				// Local storage might not be accessible
			}
		}
	}

	private persistOptions() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('plateia_selected_options', JSON.stringify(this.selectedOptions));
			} catch {
				// Local storage might not be accessible
			}
		}
	}
}

export const bookStore = new BookStore();
