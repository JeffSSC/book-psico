import type { BookMeta, BookPage, BookUiCopy } from '../../types/book';
import { fillCopy } from '../../data/uiCopy';

/**
 * Canvas 2D page painter.
 *
 * The reading surfaces are real 3D meshes, so their content is baked into
 * canvas textures. The painter lays each page out from the same `BookPage`
 * data the DOM renderer used and reports back the rectangle of every
 * interactive element, which the DOM overlay uses to place real buttons on top
 * of the 3D paper.
 *
 * The painter holds no book-specific copy of its own: page content arrives in
 * `PagePaintState.page`, and every label it prints comes from the `meta` and
 * `copy` fields of the same state.
 */

export const PAGE_TEX_WIDTH = 1024;
export const PAGE_TEX_HEIGHT = 1430;

/**
 * Backing-store supersampling for the page textures. Layout still happens in
 * the logical units above (so hit regions stay stable), but the canvas is
 * `SCALE` times larger and the painter draws through a matching transform,
 * which keeps the type crisp even in close-up reading views.
 */
export const PAGE_TEX_SCALE = 2;

/** A clickable rectangle on the page, in canvas pixels. */
export interface PageHitRegion {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
}

export interface PagePaintState {
	page: BookPage;
	pages: BookPage[];
	index: number;
	hoverId: string | null;
	selectedOptionId: string | null;
	/** Book-level copy: the cover furniture and the sheet-back mark. */
	meta: BookMeta;
	/** Interface labels: the chrome, the controls and the page furniture. */
	copy: BookUiCopy;
}

const INK = '#1C1917';
const INK_SOFT = '#57534E';
const BODY = '#3F3A33';
const INK_FAINT = '#8A857E';
const ACCENT = '#B45309';
const ACCENT_DEEP = '#78350F';

const FONT_SERIF = 'Lora, Georgia, "Times New Roman", serif';
const FONT_SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const FONT_DISPLAY = 'Cinzel, Georgia, serif';

/** One-off noise tile used to give the paper a fibre texture. */
export function createPaperGrain(ctx: CanvasRenderingContext2D | null): CanvasPattern | null {
	if (!ctx) return null;
	const tile = document.createElement('canvas');
	tile.width = 256;
	tile.height = 256;
	const tctx = tile.getContext('2d');
	if (!tctx) return null;

	const image = tctx.createImageData(256, 256);
	for (let i = 0; i < image.data.length; i += 4) {
		const value = 110 + Math.random() * 145;
		image.data[i] = value;
		image.data[i + 1] = value * 0.98;
		image.data[i + 2] = value * 0.93;
		image.data[i + 3] = 10 + Math.random() * 16;
	}
	tctx.putImageData(image, 0, 0);
	return ctx.createPattern(tile, 'repeat');
}

interface TextStyle {
	weight?: 400 | 600 | 700;
	italic?: boolean;
	family?: 'serif' | 'sans' | 'display';
	spacing?: number;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: number): void {
	// `letterSpacing` is not typed on every lib.dom version yet.
	(ctx as unknown as { letterSpacing: string }).letterSpacing = `${value}px`;
}

/**
 * Thin drawing helper adding a global type scale (used by the auto-fit pass)
 * that can run without touching the canvas.
 */
class Painter {
	readonly ctx: CanvasRenderingContext2D;
	scale = 1;
	dry = false;

	constructor(ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
	}

	/** Scales a design metric to the current type scale. */
	px(value: number): number {
		return value * this.scale;
	}

	setFont(size: number, style: TextStyle = {}): void {
		const family =
			style.family === 'sans' ? FONT_SANS : style.family === 'display' ? FONT_DISPLAY : FONT_SERIF;
		this.ctx.font = `${style.italic ? 'italic ' : ''}${style.weight ?? 400} ${this.px(size)}px ${family}`;
		setLetterSpacing(this.ctx, this.px(style.spacing ?? 0));
	}

	text(
		value: string,
		x: number,
		y: number,
		options: { align?: CanvasTextAlign; color?: string; alpha?: number } = {}
	): void {
		if (this.dry) return;
		const ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = options.color ?? INK;
		ctx.globalAlpha = options.alpha ?? 1;
		ctx.textAlign = options.align ?? 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillText(value, x, y);
		ctx.restore();
	}

	measure(value: string): number {
		return this.ctx.measureText(value).width;
	}

	/** Greedy word wrap using the font that is currently set. */
	wrap(value: string, maxWidth: number): string[] {
		return this.wrapIndented(value, maxWidth, 0, 0);
	}

	/**
	 * Word wrap where the first `indentLines` lines are `indent` pixels
	 * narrower, which is how text flows around a drop cap or a bold lead-in.
	 */
	wrapIndented(value: string, maxWidth: number, indent: number, indentLines: number): string[] {
		const words = value.split(/\s+/).filter(Boolean);
		const lines: string[] = [];
		let current = '';
		let lineIndex = 0;
		for (const word of words) {
			const available = lineIndex < indentLines ? maxWidth - indent : maxWidth;
			const candidate = current ? `${current} ${word}` : word;
			if (current && this.measure(candidate) > available) {
				lines.push(current);
				current = word;
				lineIndex++;
			} else {
				current = candidate;
			}
		}
		if (current) lines.push(current);
		return lines.length ? lines : [''];
	}

	/** Wraps and truncates to a single line, adding an ellipsis when needed. */
	ellipsize(value: string, maxWidth: number): string {
		if (this.measure(value) <= maxWidth) return value;
		let out = value;
		while (out.length > 1 && this.measure(`${out}…`) > maxWidth) {
			out = out.slice(0, -1);
		}
		return `${out}…`;
	}

	roundRect(x: number, y: number, w: number, h: number, radius: number): void {
		const ctx = this.ctx;
		const r = Math.min(radius, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	fillRound(x: number, y: number, w: number, h: number, radius: number, color: string): void {
		if (this.dry) return;
		this.ctx.save();
		this.roundRect(x, y, w, h, radius);
		this.ctx.fillStyle = color;
		this.ctx.fill();
		this.ctx.restore();
	}

	strokeRound(
		x: number,
		y: number,
		w: number,
		h: number,
		radius: number,
		color: string,
		lineWidth = 2
	): void {
		if (this.dry) return;
		this.ctx.save();
		this.roundRect(x, y, w, h, radius);
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = lineWidth;
		this.ctx.stroke();
		this.ctx.restore();
	}

	fillRect(x: number, y: number, w: number, h: number, color: string): void {
		if (this.dry) return;
		this.ctx.fillStyle = color;
		this.ctx.fillRect(x, y, w, h);
	}

	rule(x: number, y: number, w: number, color: string, thickness = 2): void {
		this.fillRect(x, y, w, this.px(thickness), color);
	}

	/** Draws pre-wrapped lines and returns the y cursor below the last one. */
	drawLines(
		lines: string[],
		x: number,
		y: number,
		lineHeight: number,
		options: { align?: CanvasTextAlign; color?: string } = {}
	): number {
		let cursor = y;
		for (const line of lines) {
			this.text(line, x, cursor, options);
			cursor += this.px(lineHeight);
		}
		return cursor;
	}

	/**
	 * Wraps then draws in one go. `x` is the text anchor, so centred text must
	 * be anchored on the middle of its column (see the `centered` helper).
	 */
	paragraph(
		value: string,
		x: number,
		y: number,
		width: number,
		size: number,
		lineHeight: number,
		style: TextStyle = {},
		options: { align?: CanvasTextAlign; color?: string } = {}
	): number {
		this.setFont(size, style);
		return this.drawLines(this.wrap(value, width), x, y, lineHeight, options);
	}

	/** Body paragraph whose first letter is set as a drop cap. */
	dropCapParagraph(
		value: string,
		x: number,
		y: number,
		width: number,
		size: number,
		lineHeight: number,
		color: string
	): number {
		const capSize = size * 2.3;
		const letter = value.charAt(0).toUpperCase();

		this.setFont(capSize, { weight: 700 });
		const indent = this.measure(letter) + this.px(size * 0.4);
		this.setFont(size);
		const capLines = Math.max(2, Math.round((capSize * 1.05) / this.px(lineHeight)));
		const lines = this.wrapIndented(value, width, indent, capLines);

		let cursor = y;
		lines.forEach((line, i) => {
			this.text(line, x + (i < capLines ? indent : 0), cursor, { color });
			cursor += this.px(lineHeight);
		});

		this.setFont(capSize, { weight: 700 });
		this.text(letter, x, y + capSize * 0.8, { color: INK });
		return cursor;
	}
}

/* ------------------------------------------------------------------ */
/* Shared page furniture                                                */
/* ------------------------------------------------------------------ */

interface Margins {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** The top chrome reserves room for the controls; the footer for progress. */
const MARGINS: Margins = { left: 92, right: 138, top: 96, bottom: 250 };

function paintPaper(p: Painter, grain: CanvasPattern | null): void {
	const ctx = p.ctx;

	const base = ctx.createLinearGradient(0, 0, 0, PAGE_TEX_HEIGHT);
	base.addColorStop(0, '#FDFBF7');
	base.addColorStop(1, '#F7F3E9');
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, PAGE_TEX_WIDTH, PAGE_TEX_HEIGHT);

	if (grain) {
		ctx.save();
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = grain;
		ctx.fillRect(0, 0, PAGE_TEX_WIDTH, PAGE_TEX_HEIGHT);
		ctx.restore();
	}

	if (p.dry) return;

	// One texture serves both faces of a sheet (the back is read through
	// mirrored UVs), so the shading stays symmetric: a soft touch on both
	// outer edges while the geometry's own gutter curve does the directional
	// work under the scene lighting.
	for (const edge of [0, 1] as const) {
		const x0 = edge === 0 ? 0 : PAGE_TEX_WIDTH;
		const x1 = edge === 0 ? PAGE_TEX_WIDTH * 0.16 : PAGE_TEX_WIDTH * 0.84;
		const shade = ctx.createLinearGradient(x0, 0, x1, 0);
		shade.addColorStop(0, 'rgba(88, 72, 50, 0.20)');
		shade.addColorStop(1, 'rgba(88, 72, 50, 0)');
		ctx.fillStyle = shade;
		ctx.fillRect(0, 0, PAGE_TEX_WIDTH, PAGE_TEX_HEIGHT);
	}
}

interface LayoutContext {
	p: Painter;
	state: PagePaintState;
	regions: PageHitRegion[];
	m: Margins;
	contentWidth: number;
}

/** Anchor x for text centred inside the page's column. */
function centered(ctx: LayoutContext): number {
	return ctx.m.left + ctx.contentWidth / 2;
}

/** Runs a layout pass without painting, so blocks can be measured and centred. */
function dryRun<T>(ctx: LayoutContext, fn: () => T): T {
	const wasDry = ctx.p.dry;
	ctx.p.dry = true;
	try {
		return fn();
	} finally {
		ctx.p.dry = wasDry;
	}
}

/* ------------------------------------------------------------------ */
/* Recto: the reading surface                                          */
/* ------------------------------------------------------------------ */

/**
 * Top chrome shared by every page: the Fechar button on the right and the
 * chapter label filling the gap to its left. The control is baked into the
 * paper and mirrored by a real DOM button.
 */
function rectoTopChrome(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth, regions } = ctx;
	const { page, copy } = state;
	const h = p.px(58);
	const closeW = p.px(170);
	const closeX = PAGE_TEX_WIDTH - m.right - closeW;

	// Fechar button
	const closeHover = state.hoverId === 'close-book';
	p.fillRound(
		closeX,
		y,
		closeW,
		h,
		p.px(12),
		closeHover ? 'rgba(254, 243, 199, 0.95)' : 'rgba(245, 245, 244, 0.9)'
	);
	p.strokeRound(
		closeX,
		y,
		closeW,
		h,
		p.px(12),
		closeHover ? 'rgba(180, 83, 9, 0.8)' : 'rgba(214, 211, 209, 0.95)',
		1.8
	);
	p.setFont(21, { weight: 700, family: 'sans' });
	p.text(copy.chrome.closeLabel, closeX + closeW / 2 + p.px(12), y + h / 2 + p.px(8), {
		align: 'center',
		color: closeHover ? ACCENT_DEEP : '#44403C'
	});
	if (!p.dry) {
		p.ctx.save();
		p.ctx.strokeStyle = closeHover ? ACCENT : '#78716C';
		p.ctx.lineWidth = 2.6;
		p.ctx.lineCap = 'round';
		const cx = closeX + p.px(40);
		const cy = y + h / 2;
		const r = p.px(8);
		p.ctx.beginPath();
		p.ctx.moveTo(cx - r, cy - r);
		p.ctx.lineTo(cx + r, cy + r);
		p.ctx.moveTo(cx + r, cy - r);
		p.ctx.lineTo(cx - r, cy + r);
		p.ctx.stroke();
		p.ctx.restore();
	}
	regions.push({
		id: 'close-book',
		x: closeX,
		y,
		w: closeW,
		h,
		label: copy.chrome.closeRegionLabel
	});

	// Chapter label centred in the gap left of the button, truncated if the
	// chapter title is too long to fit.
	const gapL = m.left;
	const gapR = closeX - p.px(24);
	if (gapR - gapL > p.px(40)) {
		const label = page.chapterNumber
			? fillCopy(copy.sections.chapterLabelTemplate, {
					number: page.chapterNumber,
					title: page.chapterTitle ?? ''
				})
			: (page.chapterTitle ?? state.meta.title);
		p.setFont(19, { weight: 700, family: 'sans', spacing: 3 });
		const display = p.ellipsize(label.toUpperCase(), gapR - gapL);
		p.text(display, (gapL + gapR) / 2, y + h / 2 + p.px(7), {
			align: 'center',
			color: ACCENT
		});
	}

	p.rule(m.left, y + h + p.px(24), contentWidth, 'rgba(120, 113, 108, 0.22)');
	return y + h + p.px(26);
}

function rectoCoverArt(ctx: LayoutContext, y: number): number {
	const { p, state } = ctx;
	const cx = PAGE_TEX_WIDTH / 2;
	const cy = y + p.px(176);
	const r = p.px(152);

	if (!p.dry) {
		const grad = p.ctx.createLinearGradient(0, cy - r, 0, cy + r);
		grad.addColorStop(0, '#FEF6DA');
		grad.addColorStop(1, '#FBE7B0');
		p.ctx.save();
		p.ctx.fillStyle = grad;
		p.ctx.beginPath();
		p.ctx.arc(cx, cy, r, 0, Math.PI * 2);
		p.ctx.fill();
		p.ctx.strokeStyle = 'rgba(180, 83, 9, 0.5)';
		p.ctx.lineWidth = 3;
		p.ctx.stroke();

		p.ctx.setLineDash([10, 10]);
		p.ctx.strokeStyle = 'rgba(180, 83, 9, 0.32)';
		p.ctx.lineWidth = 2;
		p.ctx.beginPath();
		p.ctx.arc(cx, cy, r - p.px(24), 0, Math.PI * 2);
		p.ctx.stroke();
		p.ctx.setLineDash([]);

		p.ctx.strokeStyle = 'rgba(120, 53, 15, 0.78)';
		p.ctx.lineWidth = 5;
		p.ctx.beginPath();
		p.ctx.moveTo(cx - r * 0.5, cy);
		p.ctx.quadraticCurveTo(cx, cy - r * 0.44, cx + r * 0.5, cy);
		p.ctx.quadraticCurveTo(cx, cy + r * 0.44, cx - r * 0.5, cy);
		p.ctx.stroke();

		p.ctx.fillStyle = ACCENT;
		p.ctx.beginPath();
		p.ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
		p.ctx.fill();
		p.ctx.fillStyle = '#16191F';
		p.ctx.beginPath();
		p.ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
		p.ctx.fill();
		p.ctx.restore();
	}

	const badgeW = p.px(310);
	const badgeH = p.px(46);
	const badgeY = cy + r - p.px(18);
	p.fillRound(cx - badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2, '#FFFBEB');
	p.strokeRound(cx - badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2, 'rgba(180, 83, 9, 0.55)', 1.8);
	p.setFont(19, { weight: 700, family: 'sans', spacing: 4 });
	p.text(state.meta.titlePage.badge, cx, badgeY + p.px(30), {
		align: 'center',
		color: ACCENT_DEEP
	});

	return cy + r + p.px(78);
}

function rectoTitleBlock(ctx: LayoutContext, y: number): number {
	const { p, m, contentWidth } = ctx;
	const { page } = ctx.state;
	if (!page.title) return y;

	if (page.type === 'cover') {
		p.setFont(21, { weight: 700, family: 'sans', spacing: 8 });
		p.text(ctx.state.meta.titlePage.kicker, PAGE_TEX_WIDTH / 2, y, {
			align: 'center',
			color: INK_FAINT
		});
		y += p.px(72);
		const size = page.title.length > 18 ? 60 : 72;
		y = p.paragraph(
			page.title,
			PAGE_TEX_WIDTH / 2,
			y,
			contentWidth,
			size,
			size * 1.16,
			{ weight: 700, family: 'display' },
			{ align: 'center' }
		);
		y += p.px(18);
		const cx = PAGE_TEX_WIDTH / 2;
		p.fillRect(cx - p.px(64), y, p.px(128), 2, 'rgba(180, 83, 9, 0.5)');
		if (!p.dry) {
			p.ctx.fillStyle = ACCENT;
			p.ctx.beginPath();
			p.ctx.moveTo(cx, y - 6);
			p.ctx.lineTo(cx + 7, y + 1);
			p.ctx.lineTo(cx, y + 8);
			p.ctx.lineTo(cx - 7, y + 1);
			p.ctx.closePath();
			p.ctx.fill();
		}
		y += p.px(44);
		if (page.subtitle) {
			y = p.paragraph(
				page.subtitle,
				cx,
				y,
				contentWidth,
				30,
				42,
				{ italic: true },
				{
					align: 'center',
					color: INK_SOFT
				}
			);
		}
		return y;
	}

	y = p.paragraph(page.title, m.left, y, contentWidth, 46, 54, { weight: 700 });
	if (page.subtitle) {
		y = p.paragraph(
			page.subtitle,
			m.left,
			y + p.px(8),
			contentWidth,
			25,
			34,
			{ italic: true },
			{
				color: INK_SOFT
			}
		);
	}
	return y;
}

function rectoEpigraph(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth } = ctx;
	const epigraph = state.page.epigraph;
	if (!epigraph) return y;

	const pad = p.px(26);
	const inner = contentWidth - pad * 2;
	p.setFont(26, { italic: true });
	const quoteLines = p.wrap(`“${epigraph.quote}”`, inner);
	const height = pad + quoteLines.length * p.px(36) + p.px(56);

	p.fillRound(m.left, y, contentWidth, height, p.px(14), 'rgba(253, 230, 138, 0.42)');
	p.fillRect(m.left, y, p.px(5), height, 'rgba(180, 83, 9, 0.65)');

	p.setFont(26, { italic: true });
	const cursor = p.drawLines(quoteLines, m.left + pad, y + pad + p.px(24), 36, { color: INK_SOFT });
	p.setFont(19, { weight: 700, family: 'sans' });
	p.text(`— ${epigraph.author}`, m.left + contentWidth - pad, cursor + p.px(20), {
		align: 'right',
		color: INK_FAINT
	});

	return y + height + p.px(32);
}

function rectoBody(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth } = ctx;
	const { page } = state;
	if (!page.paragraphs?.length) return y;

	const size = 27;
	const lineHeight = 42;
	page.paragraphs.forEach((text, i) => {
		if (i === 0 && !page.epigraph) {
			y = p.dropCapParagraph(text, m.left, y, contentWidth, size, lineHeight, BODY);
		} else {
			y = p.paragraph(text, m.left, y, contentWidth, size, lineHeight, {}, { color: BODY });
		}
		y += p.px(16);
	});
	return y;
}

function rectoCallout(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth } = ctx;
	const callout = state.page.callout;
	if (!callout) return y;

	const theme =
		callout.type === 'experiment'
			? { bg: 'rgba(219, 234, 254, 0.72)', border: 'rgba(147, 197, 253, 0.9)', title: '#1E3A8A' }
			: callout.type === 'warning'
				? { bg: 'rgba(254, 243, 199, 0.92)', border: 'rgba(245, 158, 11, 0.7)', title: ACCENT_DEEP }
				: {
						bg: 'rgba(254, 243, 199, 0.6)',
						border: 'rgba(253, 224, 71, 0.85)',
						title: ACCENT_DEEP
					};

	const pad = p.px(28);
	const inner = contentWidth - pad * 2;
	const titleHeight = callout.title ? p.px(34) : 0;
	p.setFont(24);
	const lines = p.wrap(callout.text, inner);
	const height = pad * 2 + titleHeight + lines.length * p.px(34);

	p.fillRound(m.left, y, contentWidth, height, p.px(14), theme.bg);
	p.strokeRound(m.left, y, contentWidth, height, p.px(14), theme.border, 1.8);

	let cursor = y + pad;
	if (callout.title) {
		p.setFont(19, { weight: 700, family: 'sans', spacing: 2 });
		p.text(callout.title.toUpperCase(), m.left + pad, cursor + p.px(20), { color: theme.title });
		cursor += titleHeight;
	}
	p.setFont(24);
	p.drawLines(lines, m.left + pad, cursor + p.px(24), 34, { color: '#44403C' });

	return y + height + p.px(32);
}

function rectoIndex(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth, regions } = ctx;
	const entries = state.page.indexEntries;
	if (!entries?.length) return y;

	const rowHeight = p.px(58);
	entries.forEach((entry, i) => {
		const rowY = y + i * rowHeight;
		const hovered = state.hoverId === `index:${entry.pageNumber}`;

		p.setFont(26);
		const display = p.ellipsize(entry.title, contentWidth - p.px(160));
		const titleWidth = p.measure(display);
		p.text(display, m.left, rowY + p.px(32), { color: hovered ? ACCENT : '#292524' });

		const numberText = String(entry.pageNumber).padStart(2, '0');
		p.setFont(24, { weight: 700, family: 'sans' });
		const numberWidth = p.measure(numberText);
		p.text(numberText, m.left + contentWidth, rowY + p.px(32), {
			align: 'right',
			color: hovered ? ACCENT : INK_FAINT
		});

		if (!p.dry) {
			p.ctx.save();
			p.ctx.setLineDash([2, 7]);
			p.ctx.strokeStyle = hovered ? 'rgba(180, 83, 9, 0.7)' : 'rgba(214, 211, 209, 0.95)';
			p.ctx.lineWidth = 2;
			p.ctx.beginPath();
			p.ctx.moveTo(m.left + titleWidth + p.px(16), rowY + p.px(25));
			p.ctx.lineTo(m.left + contentWidth - numberWidth - p.px(16), rowY + p.px(25));
			p.ctx.stroke();
			p.ctx.restore();
		}

		regions.push({
			id: `index:${entry.pageNumber}`,
			x: m.left,
			y: rowY + p.px(4),
			w: contentWidth,
			h: p.px(44),
			label: entry.title
		});
	});

	return y + entries.length * rowHeight + p.px(22);
}

function rectoReferences(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth } = ctx;
	const refs = state.page.references;
	if (!refs?.length) return y;

	const indent = p.px(22);
	for (const ref of refs) {
		// The bold author run is measured so the citation can flow around it on
		// the first line only.
		p.setFont(24, { weight: 700 });
		const headWidth = p.measure(`${ref.author} `);

		p.setFont(24);
		const rest = `(${ref.year}). ${ref.title}. ${ref.source}`;
		const lines = p.wrapIndented(rest, contentWidth - indent, headWidth, 1);

		const lineHeight = p.px(32);
		const height = lines.length * lineHeight;
		p.fillRect(m.left, y, p.px(5), height, 'rgba(214, 211, 209, 0.95)');

		p.setFont(24, { weight: 700 });
		p.text(ref.author, m.left + indent, y + p.px(24), { color: INK });

		p.setFont(24);
		let cursor = y + p.px(24);
		lines.forEach((line, i) => {
			p.text(line, m.left + indent + (i === 0 ? headWidth : 0), cursor, { color: BODY });
			cursor += lineHeight;
		});

		y += height + p.px(26);
	}
	return y;
}

function rectoAuthors(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth } = ctx;
	const authors = state.page.authors;
	if (!authors?.length) return y;

	const pad = p.px(26);
	const avatar = p.px(74);
	const textOffset = avatar + p.px(28);

	for (const author of authors) {
		const inner = contentWidth - pad * 2 - textOffset;
		p.setFont(23);
		const bioLines = p.wrap(author.bio, inner);
		const textHeight = p.px(32) + p.px(30) + bioLines.length * p.px(30);
		const cardHeight = Math.max(avatar, textHeight) + pad * 2;

		p.fillRound(m.left, y, contentWidth, cardHeight, p.px(18), 'rgba(255, 255, 255, 0.78)');
		p.strokeRound(m.left, y, contentWidth, cardHeight, p.px(18), 'rgba(214, 211, 209, 0.9)', 1.8);

		const ax = m.left + pad;
		const ay = y + pad;
		if (author.avatarText) {
			if (!p.dry) {
				p.ctx.fillStyle = 'rgba(254, 243, 199, 0.95)';
				p.ctx.beginPath();
				p.ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2);
				p.ctx.fill();
			}
			p.setFont(30, { weight: 700 });
			p.text(author.avatarText, ax + avatar / 2, ay + avatar / 2 + p.px(11), {
				align: 'center',
				color: ACCENT_DEEP
			});
		}

		let cursor = ay;
		p.setFont(29, { weight: 700 });
		p.text(author.name, m.left + pad + textOffset, cursor + p.px(24), { color: INK });
		cursor += p.px(34);
		p.setFont(20, { weight: 700, family: 'sans' });
		p.text(author.role, m.left + pad + textOffset, cursor + p.px(18), { color: ACCENT });
		cursor += p.px(30);
		p.setFont(23);
		p.drawLines(bioLines, m.left + pad + textOffset, cursor + p.px(22), 30, { color: INK_SOFT });

		y += cardHeight + p.px(22);
	}
	return y;
}

function rectoInteractive(ctx: LayoutContext, y: number): number {
	const { p, state, m, contentWidth, regions } = ctx;
	const { copy } = state;
	const activity = state.page.interactive;
	if (!activity) return y;

	const pad = p.px(26);
	const inner = contentWidth - pad * 2;
	const badgeH = p.px(40);

	p.setFont(23, { weight: 700, family: 'sans' });
	const promptLines = p.wrap(activity.prompt, inner);

	// Measure every option (and its reflection panel) before drawing anything,
	// so the panel background can sit behind the controls.
	interface OptionBox {
		id: string;
		optionLabel: string;
		reflection: string | null;
		lines: string[];
		height: number;
	}
	const boxes: OptionBox[] = [];
	for (const option of activity.options ?? []) {
		p.setFont(23);
		const lines = p.wrap(option.label, inner - p.px(36));
		const height = Math.max(p.px(58), lines.length * p.px(30) + p.px(28));
		const selected = state.selectedOptionId === option.id;
		let reflection: string | null = null;
		if (selected) {
			p.setFont(22, { italic: true });
			reflection = option.reflection;
		}
		boxes.push({
			id: `option:${option.id}`,
			optionLabel: option.label,
			reflection,
			lines,
			height
		});
	}

	const reflectionHeights = boxes.map((box) => {
		if (!box.reflection) return 0;
		p.setFont(22, { italic: true });
		const lines = p.wrap(box.reflection, inner - p.px(44));
		return p.px(56) + lines.length * p.px(30) + p.px(22);
	});

	const totalHeight =
		pad +
		badgeH +
		p.px(14) +
		promptLines.length * p.px(32) +
		p.px(16) +
		boxes.reduce((acc, box, i) => acc + box.height + p.px(10) + reflectionHeights[i], 0) +
		pad;

	const top = y;
	p.fillRound(m.left, top, contentWidth, totalHeight, p.px(16), 'rgba(250, 250, 249, 0.62)');
	p.strokeRound(m.left, top, contentWidth, totalHeight, p.px(16), 'rgba(168, 162, 158, 0.8)', 1.8);

	// Header badge
	const badgeW = p.px(292);
	p.fillRound(m.left + pad, top + pad, badgeW, badgeH, badgeH / 2, '#DCFCE7');
	p.strokeRound(
		m.left + pad,
		top + pad,
		badgeW,
		badgeH,
		badgeH / 2,
		'rgba(34, 197, 94, 0.55)',
		1.6
	);
	p.setFont(18, { weight: 700, family: 'sans', spacing: 2 });
	p.text(copy.interactive.canvasBadge, m.left + pad + badgeW / 2, top + pad + p.px(26), {
		align: 'center',
		color: '#166534'
	});

	p.setFont(23, { weight: 700, family: 'sans' });
	let cursor = p.drawLines(promptLines, m.left + pad, top + pad + badgeH + p.px(40), 32, {
		color: '#292524'
	});
	cursor += p.px(16);

	boxes.forEach((box, i) => {
		const selected = state.selectedOptionId === box.id.replace('option:', '');
		const hovered = state.hoverId === box.id;
		const fill = selected
			? 'rgba(254, 243, 199, 0.96)'
			: hovered
				? 'rgba(255, 255, 255, 1)'
				: 'rgba(255, 255, 255, 0.9)';
		const border = selected
			? 'rgba(180, 83, 9, 0.9)'
			: hovered
				? 'rgba(120, 113, 108, 0.75)'
				: 'rgba(214, 211, 209, 0.95)';

		p.fillRound(m.left + pad, cursor, inner, box.height, p.px(12), fill);
		p.strokeRound(m.left + pad, cursor, inner, box.height, p.px(12), border, selected ? 2.6 : 1.6);

		p.setFont(23);
		let textY = cursor + p.px(30);
		for (const line of box.lines) {
			p.text(line, m.left + pad + p.px(18), textY, {
				color: selected ? INK : INK_SOFT
			});
			textY += p.px(30);
		}

		regions.push({
			id: box.id,
			x: m.left + pad,
			y: cursor,
			w: inner,
			h: box.height,
			label: box.optionLabel
		});

		cursor += box.height + p.px(10);

		if (box.reflection) {
			const panelH = reflectionHeights[i];
			p.fillRound(m.left + pad, cursor, inner, panelH, p.px(10), 'rgba(245, 245, 244, 0.96)');
			p.fillRect(m.left + pad, cursor, p.px(5), panelH, 'rgba(180, 83, 9, 0.8)');
			p.setFont(17, { weight: 700, family: 'sans', spacing: 2 });
			p.text(copy.interactive.canvasReflectionTitle, m.left + pad + p.px(22), cursor + p.px(28), {
				color: INK
			});
			p.setFont(22, { italic: true });
			p.drawLines(
				p.wrap(box.reflection, inner - p.px(44)),
				m.left + pad + p.px(22),
				cursor + p.px(60),
				30,
				{
					color: INK_SOFT
				}
			);
			cursor += panelH + p.px(4);
		}
	});

	return top + totalHeight + p.px(30);
}

function rectoFooterNote(ctx: LayoutContext, y: number): number {
	const { p, state, contentWidth } = ctx;
	const note = state.page.footerNote;
	if (!note) return y;
	return (
		p.paragraph(
			note,
			centered(ctx),
			y + p.px(14),
			contentWidth,
			21,
			30,
			{ italic: true },
			{
				align: 'center',
				color: INK_FAINT
			}
		) + p.px(8)
	);
}

function paintNavButtons(ctx: LayoutContext): void {
	const { p, state, m, regions } = ctx;
	const w = p.px(236);
	const h = p.px(64);
	const y = PAGE_TEX_HEIGHT - p.px(114);

	const buttons: { id: string; label: string; x: number; enabled: boolean; dir: -1 | 1 }[] = [
		{
			id: 'nav-prev',
			label: state.copy.chrome.previousLabel,
			x: m.left,
			enabled: state.index > 0,
			dir: -1
		},
		{
			id: 'nav-next',
			label: state.copy.chrome.nextLabel,
			x: PAGE_TEX_WIDTH - m.right - w,
			enabled: state.index < state.pages.length - 1,
			dir: 1
		}
	];

	for (const button of buttons) {
		const hovered = state.hoverId === button.id;
		p.fillRound(
			button.x,
			y,
			w,
			h,
			p.px(12),
			hovered ? 'rgba(231, 229, 228, 0.98)' : 'rgba(245, 245, 244, 0.9)'
		);
		p.strokeRound(
			button.x,
			y,
			w,
			h,
			p.px(12),
			hovered ? 'rgba(168, 162, 158, 1)' : 'rgba(214, 211, 209, 0.95)',
			1.8
		);

		p.setFont(22, { weight: 700, family: 'sans' });
		const labelWidth = p.measure(button.label);
		const centerX = button.x + w / 2;
		const textY = y + h / 2 + p.px(8);
		const alpha = button.enabled ? 1 : 0.3;
		// The chevron sits on the outer side of the label and points the way
		// the reader will move: '< Anterior' on the left, 'Próxima >' on the right.
		const chevronCX = centerX + button.dir * (labelWidth / 2 + p.px(24));
		const labelX = centerX - button.dir * p.px(8);

		p.text(button.label, labelX, textY, {
			align: 'center',
			color: '#292524',
			alpha
		});

		if (!p.dry) {
			const tipX = chevronCX + button.dir * p.px(8);
			const tailX = chevronCX - button.dir * p.px(6);
			p.ctx.save();
			p.ctx.globalAlpha = alpha;
			p.ctx.strokeStyle = '#57534E';
			p.ctx.lineWidth = 3;
			p.ctx.lineCap = 'round';
			p.ctx.lineJoin = 'round';
			p.ctx.beginPath();
			p.ctx.moveTo(tailX, textY - p.px(15));
			p.ctx.lineTo(tipX, textY - p.px(5));
			p.ctx.lineTo(tailX, textY + p.px(5));
			p.ctx.stroke();
			p.ctx.restore();
		}

		if (button.enabled) {
			regions.push({ id: button.id, x: button.x, y, w, h, label: button.label });
		}
	}
}

function layoutRecto(ctx: LayoutContext): number {
	let y = rectoTopChrome(ctx, ctx.p.px(ctx.m.top));
	if (ctx.state.page.type === 'cover') {
		// Title page: lay the block out once to measure it, then re-run centred.
		const build = (start: number) => {
			const art = rectoCoverArt(ctx, start);
			return rectoFooterNote(ctx, rectoTitleBlock(ctx, art));
		};
		const slack = PAGE_TEX_HEIGHT - ctx.m.bottom - dryRun(ctx, () => build(y));
		if (slack > 0) return build(y + slack / 2);
		return build(y);
	}
	y = rectoTitleBlock(ctx, y);
	y = rectoEpigraph(ctx, y);
	y = rectoIndex(ctx, y);
	y = rectoReferences(ctx, y);
	y = rectoAuthors(ctx, y);
	y = rectoBody(ctx, y);
	y = rectoCallout(ctx, y);
	y = rectoInteractive(ctx, y);
	return rectoFooterNote(ctx, y);
}

/* ------------------------------------------------------------------ */
/* Static back: shared by every sheet                                 */
/* ------------------------------------------------------------------ */

/**
 * Paints the static back every sheet carries. One canvas and one texture serve
 * all backs, so the left pile never shows page content (and never stale
 * content): just the book's mark, steady on every sheet.
 *
 * The back is read through mirrored UVs, which lands it the right way up once
 * the sheet rests on the left — so the design stays centred and symmetric.
 */
export function paintStaticBack(
	ctx: CanvasRenderingContext2D,
	grain: CanvasPattern | null,
	meta: BookMeta
): void {
	const deviceScale = ctx.canvas.width / PAGE_TEX_WIDTH || 1;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

	const p = new Painter(ctx);
	paintPaper(p, grain);

	const cx = PAGE_TEX_WIDTH / 2;
	const maxWidth = PAGE_TEX_WIDTH - 300;
	let y = 430;

	// Small eye / spotlight mark.
	const r = p.px(92);
	if (!p.dry) {
		p.ctx.save();
		p.ctx.strokeStyle = 'rgba(180, 83, 9, 0.55)';
		p.ctx.lineWidth = 3;
		p.ctx.beginPath();
		p.ctx.arc(cx, y, r, 0, Math.PI * 2);
		p.ctx.stroke();
		p.ctx.setLineDash([8, 8]);
		p.ctx.strokeStyle = 'rgba(180, 83, 9, 0.3)';
		p.ctx.lineWidth = 2;
		p.ctx.beginPath();
		p.ctx.arc(cx, y, r - p.px(18), 0, Math.PI * 2);
		p.ctx.stroke();
		p.ctx.setLineDash([]);
		p.ctx.strokeStyle = 'rgba(120, 53, 15, 0.7)';
		p.ctx.lineWidth = 4;
		p.ctx.beginPath();
		p.ctx.moveTo(cx - r * 0.45, y);
		p.ctx.quadraticCurveTo(cx, y - r * 0.4, cx + r * 0.45, y);
		p.ctx.quadraticCurveTo(cx, y + r * 0.4, cx - r * 0.45, y);
		p.ctx.stroke();
		p.ctx.fillStyle = ACCENT;
		p.ctx.beginPath();
		p.ctx.arc(cx, y, r * 0.18, 0, Math.PI * 2);
		p.ctx.fill();
		p.ctx.restore();
	}
	y += r + p.px(64);

	y = p.paragraph(
		meta.back.title,
		cx,
		y,
		maxWidth,
		44,
		54,
		{
			weight: 700,
			family: 'display'
		},
		{ align: 'center' }
	);
	y += p.px(18);
	p.fillRect(cx - p.px(48), y, p.px(96), 2, 'rgba(180, 83, 9, 0.5)');
	y += p.px(40);

	y = p.paragraph(
		meta.back.quote,
		cx,
		y,
		maxWidth,
		27,
		40,
		{ italic: true },
		{ align: 'center', color: INK_SOFT }
	);
	y += p.px(48);

	p.setFont(19, { weight: 700, family: 'sans', spacing: 5 });
	p.text(meta.back.badge, cx, y, {
		align: 'center',
		color: INK_FAINT
	});

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	setLetterSpacing(ctx, 0);
}

function runLayout(
	p: Painter,
	state: PagePaintState,
	regions: PageHitRegion[],
	grain: CanvasPattern | null,
	scale: number,
	dry: boolean
): number {
	p.scale = scale;
	p.dry = dry;
	paintPaper(p, grain);

	const ctx: LayoutContext = {
		p,
		state,
		regions,
		m: MARGINS,
		contentWidth: PAGE_TEX_WIDTH - MARGINS.left - MARGINS.right
	};

	// Fixed chrome first, then the flowing content, then the fixed navigation —
	// which also gives the DOM buttons a sensible tab order.
	const end = layoutRecto(ctx);
	paintNavButtons(ctx);
	return end;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */

/**
 * Paints a page into `ctx` and returns the interactive rectangles it drew.
 * The content is measured first so long chapters shrink instead of spilling
 * over the edge of the paper.
 *
 * Layout happens in logical page units; the canvas backing store is expected
 * to be `PAGE_TEX_SCALE` times larger, and the painter draws through a
 * matching transform so the type stays crisp in close-up reading views.
 */
export function paintPage(
	ctx: CanvasRenderingContext2D,
	state: PagePaintState,
	grain: CanvasPattern | null
): PageHitRegion[] {
	const deviceScale = ctx.canvas.width / PAGE_TEX_WIDTH || 1;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

	const p = new Painter(ctx);

	const probe = runLayout(p, state, [], grain, 1, true);
	const available = PAGE_TEX_HEIGHT - MARGINS.top - MARGINS.bottom;
	const overflow = probe - MARGINS.top;
	const scale = Math.max(0.7, Math.min(1, available / Math.max(overflow, 1)));

	const regions: PageHitRegion[] = [];
	ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
	runLayout(p, state, regions, grain, scale, false);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	setLetterSpacing(ctx, 0);
	return regions;
}

/** Makes sure the web fonts the painter relies on are ready. */
export async function ensurePageFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	const specs = [
		'400 24px Lora',
		'italic 400 24px Lora',
		'700 40px Lora',
		'400 20px "Plus Jakarta Sans"',
		'700 20px "Plus Jakarta Sans"',
		'700 40px Cinzel'
	];
	await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => undefined)));
	await document.fonts.ready;
}
