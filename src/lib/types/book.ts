export type PageType =
	'cover' | 'index' | 'standard' | 'references' | 'authors' | 'epigraph' | 'interactive';

export interface PageMedia {
	type: 'image' | 'illustration' | 'diagram' | 'quote-card';
	src?: string;
	alt?: string;
	caption?: string;
	badge?: string;
}

export interface InteractiveConfig {
	activityType: 'dilemma' | 'spotlight-quiz' | 'perspective-test' | 'canvas-game';
	title: string;
	prompt: string;
	options?: Array<{
		id: string;
		label: string;
		reflection: string;
	}>;
	estimatedMinutes?: number;
}

export interface IndexEntry {
	title: string;
	pageNumber: number;
	chapterNumber?: number;
}

export interface ReferenceItem {
	author: string;
	year: string;
	title: string;
	source: string;
}

export interface AuthorProfile {
	name: string;
	role: string;
	avatarText?: string;
}

export interface BasePageData {
	id: string;
	pageNumber: number;
	chapterNumber?: number;
	chapterTitle?: string;
	type: PageType;
	title?: string;
	subtitle?: string;
	paragraphs?: string[];
	callout?: {
		title?: string;
		text: string;
		type?: 'insight' | 'experiment' | 'warning';
	};
	indexEntries?: IndexEntry[];
	references?: ReferenceItem[];
	authors?: AuthorProfile[];
	epigraph?: {
		quote: string;
		author: string;
	};
	media?: PageMedia;
	interactive?: InteractiveConfig;
	footerNote?: string;
}

export type BookPage = BasePageData;

export type FlipDirection = 'next' | 'prev';
export type BookUIState = 'closed' | 'opening' | 'opened' | 'closing';

/** Which page of the open spread the mobile single-page view is showing. */
export type PageSide = 'left' | 'right';

/** How the open book is framed: two-page spread or a single zoomed page. */
export type ViewMode = 'spread' | 'single';

/* ------------------------------------------------------------------ */
/* Book-level copy                                                      */
/* ------------------------------------------------------------------ */

/**
 * Copy printed about the work as a whole rather than about a single page.
 *
 * Every string is stored exactly as the surface that draws it renders it: the
 * canvas textures bake their own display casing, while the DOM reader
 * uppercases some labels with CSS. Nothing is re-cased at paint time.
 */
export interface BookMeta {
	/** Title of the work, used wherever the book itself is named. */
	title: string;
	/** `<title>` and meta description for the document. */
	seo: {
		title: string;
		description: string;
	};
	/** Gold foil lettering of the front cover. */
	cover: {
		badge: string;
		/** Stacked top to bottom under the cover's eye motif. */
		titleLines: string[];
		subtitleLines: string[];
		credits: string;
		edition: string;
	};
	/** The single static mark every sheet back carries. */
	back: {
		title: string;
		quote: string;
		badge: string;
	};
	/** Cover furniture painted onto the paper texture. */
	titlePage: {
		badge: string;
		kicker: string;
	};
	/** The same cover furniture as the DOM reader spells it. */
	titlePageDom: {
		badge: string;
		kicker: string;
	};
}

/** Copy for the closed-book overlay sitting on the 3D desk. */
export interface ExperienceCopy {
	/** `{title}` is replaced with the book title. */
	regionLabel: string;
	openLabel: string;
	openButtonLabel: string;
	openHint: string;
	clickToOpenLabel: string;
}

/** Navigation chrome shared by the page textures and the DOM chrome. */
export interface PageChromeCopy {
	closeLabel: string;
	closeRegionLabel: string;
	/** `{current}` and `{total}` are replaced with the page position. */
	pageCounterTemplate: string;
	previousLabel: string;
	nextLabel: string;
	keyboardHint: string;
}

/** Copy for the table of contents dialog and the control that opens it. */
export interface TableOfContentsCopy {
	dialogLabel: string;
	heading: string;
	subtitle: string;
	closeLabel: string;
	coverTitleFallback: string;
	pageTitleFallback: string;
	interactiveBadge: string;
	readingNow: string;
	/** `{percent}` is replaced with the reading progress. */
	progressTemplate: string;
	/** `{count}` is replaced with the total page count. */
	totalTemplate: string;
	buttonLabel: string;
	buttonTitle: string;
}

/** Copy for the audio toggle. */
export interface AudioCopy {
	onTitle: string;
	offTitle: string;
	toggleLabel: string;
	/** Compact labels for the floating toggle. */
	onLabel: string;
	offLabel: string;
	/** Verbose labels for the header toggle. */
	onLabelLong: string;
	offLabelLong: string;
}

/** Copy for the flat DOM reader. */
export interface ReaderCopy {
	regionLabel: string;
	closeTitle: string;
	closeLabel: string;
	previousRegionLabel: string;
	nextRegionLabel: string;
}

/** Headings a page falls back to when it carries none of its own. */
export interface SectionCopy {
	index: string;
	indexTitle: string;
	references: string;
	referencesTitle: string;
	authors: string;
	authorsTitle: string;
	standard: string;
	/** `{number}` and `{title}` are replaced with the chapter's position. */
	chapterLabelTemplate: string;
}

/** Copy around the answer controls. */
export interface InteractiveCopy {
	badge: string;
	selectHint: string;
	reflectionTitle: string;
	/** The two labels above are rendered uppercase by the canvas painter. */
	canvasBadge: string;
	canvasReflectionTitle: string;
}

/**
 * Every user-facing string that is not page content, so the components and
 * painters stay blank and all copy lives in `src/lib/data`.
 */
export interface BookUiCopy {
	experience: ExperienceCopy;
	chrome: PageChromeCopy;
	tableOfContents: TableOfContentsCopy;
	audio: AudioCopy;
	reader: ReaderCopy;
	sections: SectionCopy;
	interactive: InteractiveCopy;
}
