/** One illustrated page of the HQ: the cover or a story page. */
export interface ComicPage {
	id: string;
	/** Number of the page image (`NN-<width>.<format>` in `assets/hq`). */
	image: number;
	title: string;
	alt: string;
	/** Intrinsic size of the largest image, for layout before it loads. */
	width: number;
	height: number;
	/** Dominant colour, painted while the image decodes. */
	color: string;
}

/** One face of the book: an illustrated page or the drawn back cover. */
export type BookFace = { kind: 'page'; id: string; page: ComicPage } | { kind: 'back'; id: string };

export interface Comic {
	cover: ComicPage;
	pages: ComicPage[];
}

/** What a `<picture>` needs to offer AVIF with a WebP fallback. */
export interface PageSources {
	avif: string;
	webp: string;
	src: string;
	width: number;
	height: number;
}

export type FlipDirection = 'next' | 'prev';

/** Which page of the open spread the mobile single-page view is showing. */
export type PageSide = 'left' | 'right';

/** How the open book is framed: two-page spread or a single page. */
export type ViewMode = 'spread' | 'single';

/** Copy about the work as a whole. */
export interface BookMeta {
	/** Title of the work, used wherever the HQ itself is named. */
	title: string;
	/** `<title>` and meta description for the document. */
	seo: {
		title: string;
		description: string;
	};
}

/** Copy for the closed HQ. */
export interface ExperienceCopy {
	/** `{title}` is replaced with the title of the work. */
	regionLabel: string;
	openLabel: string;
}

/** Accessible names of the two click areas over the open pages. */
export interface ReaderCopy {
	previousRegionLabel: string;
	nextRegionLabel: string;
	backCoverLabel: string;
}

/** Every user-facing string that is not part of the art. */
export interface BookUiCopy {
	experience: ExperienceCopy;
	reader: ReaderCopy;
}
