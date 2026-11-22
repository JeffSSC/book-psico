# HQ "O Parque dos Mil Olhos"

- **Status:** done
- **Tests approved:** yes
- **Briefing:** Turn the text book into an image-based HQ (comic) reader named "O Parque dos Mil Olhos", using the 15 page PNGs in `../O parque dos mil olhos/`, with white borders cut, small optimized images, fast load and mobile-responsive layout. Free to redesign.

## 1. TDD

### Test patterns

- **Runner / command:** `pnpm test` (all), `pnpm vitest run --project server <file>`, `pnpm vitest run --project client <file>`.
- **Layout & naming:** tests sit next to the unit. `*.spec.ts` runs in node (`server` project); `*.svelte.spec.ts` runs in headless Chromium (`client` project). The `server` project `include` gains `scripts/**/*.spec.ts` for the image pipeline.
- **Fixtures / test data:** pipeline tests build synthetic PNGs in memory with `sharp` (coloured block + white border of known size) and write to an `os.tmpdir()` folder. Asset tests read the real committed files in `src/lib/assets/hq/`.
- **Doubles:** none for the pipeline (real `sharp`, real temp files). Browser tests drive the real `bookStore` singleton and reset it per test, as `BookScene.svelte.spec.ts` does today. `localStorage` is stubbed the way `bookStore.spec.ts` already stubs it.
- **Layers used:** unit (pure functions, store, data), integration (pipeline on real files, committed-asset budget), component/e2e in browser (reader flows).

### Test list

**Image pipeline — `scripts/hq/*.spec.ts`**

| ID  | Layer       | Test name                                                          | Asserts                                                                                                                                  |
| --- | ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | unit        | `fitToAspect returns the largest centred box of the target aspect` | given 1414×1909 and 3:4 → 1414×1885 centred; given 1401×1865 → 1399×1865 centred; box never exceeds input                                |
| T2  | unit        | `fitToAspect rejects a crop that loses more than 2% on an axis`    | given 1406×1981 and 3:4 → throws naming the page, so art is never silently cut                                                           |
| T3  | unit        | `outputName zero-pads the page and names width and format`         | `(3, 720, 'avif')` → `03-720.avif`; `(12, 1400, 'webp')` → `12-1400.webp`                                                                |
| T4  | integration | `trims the white border from every side`                           | given a PNG with 20px white top/bottom and 6px white left → no outer row or column of the output is entirely near-white (≥ 245)          |
| T5  | integration | `keeps white that is inside the art`                               | given a PNG whose interior has a white stripe (comic gutter) → the stripe is still present after trimming                                |
| T6  | integration | `story pages come out at exactly 3:4`                              | given trimmed inputs of slightly different aspects → every output is `width × round(width·4/3)`                                          |
| T7  | integration | `the cover keeps its own aspect`                                   | given a cover-flagged input of aspect 0.71 → output aspect is 0.71 ±0.005, not 3:4                                                       |
| T8  | integration | `emits AVIF and WebP at each width and never upscales`             | given a 1000px-wide source and widths [720, 1400] → `720` in both formats, and the large variant is 1000px wide, not 1400                |
| T9  | integration | `writes a manifest in numeric page order`                          | given inputs `1.png … 12.png` → manifest pages ordered 1,2,…,12 (not 1,10,11,2), each with width, height and a `#rrggbb` dominant colour |

**Committed assets — `src/lib/data/hqAssets.spec.ts`**

| ID  | Layer       | Test name                                      | Asserts                                                                                                   |
| --- | ----------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T10 | integration | `every page has AVIF and WebP at 720 and 1400` | for pages 01–15, the 4 files exist in `src/lib/assets/hq/` and match the manifest                         |
| T11 | integration | `images stay inside the size budget`           | each 720 AVIF ≤ 150 KB; each 1400 AVIF ≤ 300 KB; cover 720 AVIF ≤ 120 KB; all 720 AVIFs together ≤ 1.8 MB |
| T12 | integration | `no committed page has a white outer border`   | for every 720 WebP, no outer row or column is entirely near-white                                         |

**Comic data — `src/lib/data/comic.spec.ts` (replaces `bookPages.spec.ts`)**

| ID  | Layer | Test name                                             | Asserts                                                                                                                                                   |
| --- | ----- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T13 | unit  | `has one cover and 14 story pages in reading order`   | `comic.cover` is image 1; `comic.pages` has 14 entries, images 2–15, ids unique                                                                           |
| T14 | unit  | `lists the 12 chapters of the Sumário`                | titles equal the Sumário (Introdução … Além do parque); each `pageIndex` is valid and strictly ascending; Introdução → index 1, Além do parque → index 12 |
| T15 | unit  | `every page has pt-BR alt text`                       | cover and all 14 pages have a non-blank `alt`                                                                                                             |
| T16 | unit  | `pageSources builds one srcset per format`            | given a page → `avif` and `webp` srcsets each list `… 720w, … 1400w`, plus a WebP 720 fallback `src` and intrinsic `width`/`height`                       |
| T17 | unit  | `pagesToPreload returns what the next turn will show` | spread mode at spread 0 → indexes [2, 3]; single mode on the left page → [right page]; last position → []                                                 |

**Copy and geometry (updated existing specs)**

| ID  | Layer | Test name                                                                         | Asserts                                                                                                            |
| --- | ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| T18 | unit  | `bookMeta names the work` (updates `bookCopy.spec.ts`)                            | title is `O Parque dos Mil Olhos`; SEO title and description are non-blank and mention the title                   |
| T19 | unit  | `bookUiCopy has no blank strings and no quiz labels` (updates `bookCopy.spec.ts`) | every string non-blank; groups are `experience`, `toc`, `audio`, `reader`, `zoom`; the `interactive` group is gone |
| T20 | unit  | `defines a 3:4 page and a gutterless spread` (updates `pageScale.spec.ts`)        | `PAGE_WIDTH/PAGE_HEIGHT === 3/4`; `SPREAD_WIDTH === 2 × PAGE_WIDTH`                                                |
| T21 | unit  | `viewModeFor picks the spread only when two pages fit well`                       | 1440×900 → `spread`; 390×844 → `single`; 820×1180 (tablet portrait) → `single`; 1180×820 → `spread`                |

**Store — `bookStore.spec.ts`**

| ID  | Layer | Test name                                                                                                                                  | Asserts                                                                                                      |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| T22 | unit  | `persists the position under the comic key` (replaces `restores the saved position` + `persists the position when a transition completes`) | completing a turn writes `parque_position`; a new store restores it                                          |
| T23 | unit  | `ignores a position saved by the old book` (replaces `migrates the legacy single-page position`)                                           | given only `plateia_position` / `plateia_page_index` in storage → store starts at spread 0, left             |
| —   | unit  | all other existing `BookStore` tests                                                                                                       | unchanged, still green (position model, spread/single stepping, `goToPage`, progress, view mode, open/close) |
| —   | unit  | `interactive answers` (2 tests)                                                                                                            | **removed** with `selectOptionForPage`; the HQ has no quiz                                                   |

**Reader — `BookScene.svelte.spec.ts` (rewritten), `PageZoom.svelte.spec.ts`, `TableOfContentsModal.svelte.spec.ts`**

| ID  | Layer   | Test name                                                     | Asserts                                                                                                                                                         |
| --- | ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T24 | browser | `shows the cover art and opens the comic`                     | closed state renders the cover `<img>` (alt set, `loading="eager"`, `fetchpriority="high"`) inside a button labelled "Abrir a HQ"; clicking it reaches `opened` |
| T25 | browser | `shows two page images per spread and turns forward and back` | spread mode shows images alt "Sumário" + "Introdução"; `next()` then shows story pages 3 and 4; `prev()` returns                                                |
| T26 | browser | `shows one page image on a phone and slides to the next`      | single mode shows exactly one page image; next → the following page; never two at once                                                                          |
| T27 | browser | `only mounts the pages on screen`                             | opened in spread mode, the reader holds at most 4 page `<img>` elements (current spread + turning leaf), not all 14                                             |
| T28 | browser | `arrow keys turn the page`                                    | ArrowRight advances, ArrowLeft goes back                                                                                                                        |
| T29 | browser | `a horizontal swipe turns the page on a phone`                | single mode: pointer drag left ≥ 48px → next; drag right → prev; a vertical drag does nothing                                                                   |
| T30 | browser | `zoom opens the page large and closes on Escape`              | "Ampliar página" opens a dialog whose image offers the 1400w source and scrolls in both axes; Escape closes it and focus returns to the zoom button             |
| T31 | browser | `swipes and arrow keys do not turn the page while zoomed`     | with the zoom dialog open, ArrowRight and a swipe leave the position unchanged                                                                                  |
| T32 | browser | `the Sumário lists 12 chapters and jumps to one`              | modal shows the 12 chapter titles; choosing "O sapo" lands on the spread containing its page and closes the modal                                               |

## 2. Business Rules

| ID  | Rule                                                                                                                                           | Tests              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| R1  | No published page image has a white outer border.                                                                                              | T4, T12            |
| R2  | Trimming removes only the outer border; white inside the art (panel gutters, balloons) is kept.                                                | T5                 |
| R3  | All 14 story pages share one 3:4 shape so spreads align; normalising never cuts more than 2% of an axis.                                       | T1, T2, T6, T20    |
| R4  | The cover keeps its own proportions.                                                                                                           | T7                 |
| R5  | Every page ships as AVIF with WebP fallback at 720 and 1400 px wide, never upscaled.                                                           | T8, T10, T16       |
| R6  | Image weight stays in budget: 720 AVIF ≤ 150 KB per page, whole comic ≤ 1.8 MB at phone size, cover ≤ 120 KB.                                  | T11                |
| R7  | The comic is one cover plus 14 story pages in the order of the source files 1–15.                                                              | T9, T13            |
| R8  | The Sumário has the 12 chapters printed on the Sumário page, each opening the right page.                                                      | T14, T32           |
| R9  | Every page image has pt-BR alt text.                                                                                                           | T15, T24, T25      |
| R10 | The first paint needs only the cover: the cover loads eagerly with high priority, other pages load when shown, and the next turn is preloaded. | T17, T24, T27      |
| R11 | Wide screens show two pages; phones and portrait tablets show one.                                                                             | T21, T25, T26      |
| R12 | Pages turn by buttons, arrow keys and, in single-page view, horizontal swipe.                                                                  | T25, T26, T28, T29 |
| R13 | Any page can be enlarged to read small lettering; while enlarged, navigation gestures are off.                                                 | T30, T31           |
| R14 | The work is named "O Parque dos Mil Olhos" everywhere the app prints a title.                                                                  | T18                |
| R15 | The last-read position survives a reload; positions saved by the old text book are ignored.                                                    | T22, T23           |
| R16 | No quiz or text-page UI remains.                                                                                                               | T19                |

## 3. Behaviour Changes

| Area            | Before                                                                       | After                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Content         | 12 typeset text pages (Plateia Imaginária essay, quiz, references, authors)  | 15 illustrated pages: cover + 14 story pages; all text is in the art                                                                        |
| Title / SEO     | "Plateia Imaginária — Livro Interativo 3D de Psicologia"                     | "O Parque dos Mil Olhos — HQ" with a matching description                                                                                   |
| Cover           | Drawn CSS book board with gold lettering                                     | The cover illustration itself; opening zooms through the gate into the first spread                                                         |
| Look            | Cream paper desk (`#FAF8F5`), Cinzel + Lora + Plus Jakarta from Google Fonts | Night-forest stage (deep navy, amber lantern glow, a few CSS fireflies), one self-hosted pixel font for chrome, no third-party font request |
| Desktop reading | Two text pages with leaf turn                                                | Two art pages with the same leaf turn                                                                                                       |
| Phone reading   | One text page, buttons only                                                  | One art page fit to the screen, swipe or buttons, tap "Ampliar" to enlarge and pan                                                          |
| Mode switch     | Single below 768px wide                                                      | Single whenever two pages would not fit well (phones, portrait tablets)                                                                     |
| Sumário         | Entries from the text book index page                                        | The 12 chapters printed on the comic's Sumário page                                                                                         |
| Loading         | All text, three web-font families                                            | Prerendered HTML; cover ≈ 85 KB first; each page ≈ 100 KB on demand; next turn preloaded; dominant-colour placeholder while a page decodes  |
| Saved position  | `plateia_position` (with legacy migration)                                   | `parque_position`; old keys ignored                                                                                                         |

## 4. Technical Implementation

- **Files touched:**
  - New: `scripts/hq/build-pages.ts` (CLI: source dir → `src/lib/assets/hq/` + manifest), `scripts/hq/pipeline.ts` (`fitToAspect`, `outputName`, `processPage`, `processAll`), `scripts/hq/pipeline.spec.ts`.
  - New: `src/lib/assets/hq/NN-{720,1400}.{avif,webp}` (60 files, committed), `src/lib/data/hqManifest.json` (generated: width, height, dominant colour per page).
  - New: `src/lib/data/comic.ts` (cover, pages, chapters, alt text, `pageSources`, `pagesToPreload`), `comic.spec.ts`, `hqAssets.spec.ts`.
  - New: `src/lib/components/book/ComicPage.svelte` (`<picture>` + placeholder), `PageZoom.svelte` (+ spec), `swipe.ts` (pointer-swipe action), `TableOfContentsModal.svelte.spec.ts`, `src/routes/+page.ts` (`prerender = true`).
  - Modified: `BookScene.svelte` (stage theme, mode by `viewModeFor`, preload, zoom, swipe), `BookCover.svelte` (cover art + gate-zoom open), `BookSpread.svelte`, `BookSinglePage.svelte`, `PageLeaf.svelte` (render `ComicPage`), `BookHeader.svelte`, `BookFooter.svelte`, `TableOfContentsModal.svelte` (theme, chapters), `pageScale.ts`, `bookMeta.ts`, `uiCopy.ts`, `types/book.ts`, `bookStore.svelte.ts` (storage key, drop quiz answers), `index.ts`, `app.html` (drop Google Fonts, theme-colour), `layout.css`, `+page.svelte`, `package.json` (`hq:build` script), `vite.config.ts` (test include).
  - Deleted: `src/lib/data/chapters/*`, `bookPages.ts`, `bookPages.spec.ts`, `initialPages.ts`, `PageContentRenderer.svelte`, `PageView.svelte`.
- **Reused:** `BookStore` position/flip/gating model and its tests (`src/lib/stores/bookStore.svelte.ts`); spread/single/leaf components and their CSS transitions; `fitScale` in `pageScale.ts`; `sfx.ts` page-turn sounds; `reducedMotion.ts`; `fillCopy` templates; the TOC modal shell.
- **Design:**
  - _Offline pipeline, committed outputs_: images are generated once by `pnpm hq:build` and committed, so deploys need neither the 54 MB sources nor `sharp`.
  - _Vite asset imports_ (`import.meta.glob` on `src/lib/assets/hq/*`): files get content-hashed names under `_app/immutable/`, so hosts cache them forever.
  - _`<picture>` with AVIF + WebP srcset_ and `sizes` set from the current page scale: the browser picks 720 on phones/spreads and 1400 for retina and zoom.
  - _One pure data module (`comic.ts`)_ replaces 12 chapter files; components stay presentational.
  - _Pure helpers for decisions_ (`fitToAspect`, `viewModeFor`, `pagesToPreload`, `pageSources`) so the rules are unit-tested without a browser.
  - _Zoom as a dialog_ with native scrolling for pan: no gesture library, works with mouse, touch and keyboard.
  - _Ambient effects in CSS only_ (fireflies, lantern glow), off under `prefers-reduced-motion`.
- **Dependencies:** `sharp` (dev, image pipeline and tests); `@fontsource/pixelify-sans` (dev, self-hosted woff2, latin subset only).

## 5. Considerations

- **Assumptions:**
  - The HQ replaces the text book; the old essay pages, quiz and authors page are removed (still in git history).
  - Source PNGs stay in `../O parque dos mil olhos/`, outside the git repo, and are not committed.
  - Image 1 is the cover; images 2–15 are story pages, giving 7 full spreads (Sumário + Introdução first, Além do parque + Bibliografia last).
  - Pixel font for chrome is Pixelify Sans (OFL); swap is a one-line change.
  - Package/repo name `plateia-imaginaria` stays.
- **Edge cases:**
  - Trimmed pages differ slightly in shape (0.741–0.753); centre crop to 3:4 loses at most 1.3% of one axis. Above 2% the build fails (T2).
  - Comic pages have white paper inside the frame; trimming stops at the first non-white row/column, so the paper stays (T5).
  - Soft anti-aliased border edges: the trim uses a tolerance and shaves 2px after trimming; checked visually in S2.
  - Browsers without AVIF get WebP; both are covered by the same `<picture>`.
  - Resize between spread and single mid-turn keeps the existing rule: the mode only changes while idle.
  - A saved position past the end is clamped by the existing store logic.
- **Risks:**
  - Lettering is small on phones at fit-to-screen size; zoom (R13) is the mitigation. If it still reads poorly, a continuous vertical-scroll mode is the next option.
  - AVIF at quality ~55 could blur pixel-art edges; S2 compares against the source and raises quality within the budget if needed.
- **Out of scope:**
  - Text transcription of the pages (screen-reader/SEO full text); pages get descriptive alt text only.
  - Clickable rows on the illustrated Sumário page (the Sumário modal covers navigation).
  - Fixing the art itself: the Bibliografia page prints "Página 13" (same as the page before it), and a few balloons have typos ("dessenvolvimento", "hirríveis", "Qaundo").
  - Credits for the authors, since no credits page exists among the 15 images.
  - Updating the `AD/` design docs.

## 6. Steps

- [x] S1: Pipeline maths and naming — `fitToAspect`, `outputName`; add `sharp`, `scripts/**` test include (T1, T2, T3)
  - Tests T1–T3 (4 cases) in `scripts/hq/pipeline.spec.ts`; files `scripts/hq/pipeline.ts`, `vite.config.ts`, `package.json`; reviewed together with S2, 1 round, no blocking findings.
- [x] S2: Pipeline on files — trim, 3:4 normalise, cover exception, AVIF/WebP at 720/1400, manifest; `pnpm hq:build`; run it on the 15 sources, inspect results, commit outputs (T4, T5, T6, T7, T8, T9, T10, T11, T12)
  - Tests T4–T9 in `scripts/hq/pipeline.spec.ts`, T10–T12 in `src/lib/data/hqAssets.spec.ts`; files `scripts/hq/pipeline.ts`, `scripts/hq/build-pages.ts`, `src/lib/assets/hq/*` (60 images), `src/lib/data/hqManifest.json`; 1 review round. T8 fixture uses 1004px of art because a 2px halo is shaved after trimming (page is 1000px). Build takes ~7 min (AVIF effort 6).
- [x] S3: Comic data — `comic.ts` with cover, pages, chapters, alt text, `pageSources`, `pagesToPreload`; delete chapter files and `bookPages` (T13, T14, T15, T16, T17)
  - Tests T13–T17 in `src/lib/data/comic.spec.ts` (alt-text test strengthened after review: each page has a hand-written description); files `src/lib/data/comic.ts`, `src/lib/types/book.ts`. Deleting the chapter files and `bookPages` moved to S6, because the old reader still rendered them. Reviewed with S4–S9: 2 rounds.
- [x] S4: Copy and geometry — `bookMeta`, `uiCopy`, types, 3:4 `pageScale`, `viewModeFor` (T18, T19, T20, T21)
  - Tests T18–T21 in `bookCopy.spec.ts` and `pageScale.spec.ts`, plus `imageSizes` (added after review); files `bookMeta.ts`, `uiCopy.ts`, `types/book.ts`, `pageScale.ts`. Copy groups are `experience`, `reader`, `toc`, `audio`, `zoom`.
- [x] S5: Store — comic storage key, drop legacy migration and quiz answers (T22, T23)
  - Tests T22–T23 in `bookStore.spec.ts`; 2 quiz tests and the legacy-migration test removed; file `bookStore.svelte.ts`. The audio preference key is also new (`parque_audio_enabled`), so a mute set in the old book is not carried over.
- [x] S6: Reader shows art — `ComicPage`, cover art + open, spread/single/leaf render images, mount only visible pages, preload next turn, delete text renderers (T24, T25, T26, T27, T28)
  - Tests T24–T28 in `BookScene.svelte.spec.ts` (the spec loads `routes/layout.css` so layering matches the real page). Files: `ComicPage.svelte`, `Fireflies.svelte`, `BookCover.svelte`, `BookScene.svelte`, `BookSpread.svelte`, `BookSinglePage.svelte`, `PageLeaf.svelte`, `BookHeader.svelte`, `BookFooter.svelte`, `index.ts`, `+page.svelte`; deleted `chapters/*`, `bookPages*`, `initialPages.ts`, `PageContentRenderer.svelte`, `PageView.svelte`. The implementation was written before this step's tests (S4–S6 were one coupled pass). In single mode the track mounts the page on screen plus its two neighbours (inert), so a slide has both pages. The cover is sized in CSS so the prerendered HTML is correct before JS.
- [x] S7: Phone input — swipe action in single mode (T29)
  - Test T29 (plus the click after a swipe is swallowed) in `BookScene.svelte.spec.ts`; files `swipe.ts`, `BookScene.svelte`.
- [x] S8: Zoom dialog (T30, T31)
  - Tests T30–T31 in `BookScene.svelte.spec.ts` (they need the scene, so there is no separate `PageZoom` spec), plus a mouse-drag-pans test added after review; files `PageZoom.svelte`, `BookScene.svelte`. Zoom opens from a per-page button or a tap on the art.
- [x] S9: Sumário modal on comic chapters (T32)
  - Test T32 in `TableOfContentsModal.svelte.spec.ts`, plus "Escape in the Sumário closes only the Sumário" and focus return (added after review); file `TableOfContentsModal.svelte`, now a native modal `<dialog>`.
- [x] S10: Look and load — night-forest theme, fireflies, pixel font, drop Google Fonts, `prerender`, cover preload; verify with `pnpm build && pnpm preview` at 390px and 1440px that the first load requests only the HTML, CSS/JS, font and cover image (no new tests; all suites green, `pnpm check` and `pnpm lint` clean)
  - No new tests. Files `layout.css`, `app.html`, `+page.ts`, `tsconfig.json` (scripts are type-checked). Verified on the production build in Chromium at 1440×900 and 390×844 @2x: first load is 15 requests — HTML, JS/CSS, one 8 KB font and the 82 KB cover; each turn fetches only the next pages at 720px; no console errors. `pnpm test` 76 passed, `pnpm check` and `pnpm lint` clean.

## 7. Updates

| Date | Change | Sections touched |
| ---- | ------ | ---------------- |
