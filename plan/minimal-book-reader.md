# Minimal book reader

- **Status:** in-progress
- **Tests approved:** yes
- **Briefing:** Make the HQ reader minimalist and book-like: no header, no footer, no Sumário, no sound button, no close button, no zoom. Click the left page to go back and the right page to go forward. Only the paper sound remains. Brighter (warm parchment) background.

## 1. TDD

### Test patterns

- **Runner / command:** `pnpm test` (all), `pnpm vitest run --project server <file>`, `pnpm vitest run --project client <file>`.
- **Layout & naming:** tests sit next to the unit. `*.spec.ts` runs in node; `*.svelte.spec.ts` runs in headless Chromium.
- **Fixtures / test data:** store tests build a `BookStore` with 12 fake pages (`makeStore()` in `bookStore.spec.ts`). Browser tests render `BookScene` with the real `comic` and reset the singleton store per test (`resetStore()`, `mountOpened()`), and load `routes/layout.css`.
- **Doubles:** `vi.mock('../audio/sfx')` in the store spec to observe which sound is asked for (a collaborator, not the unit). `localStorage` stubbed as the store spec already does. Fake timers for the 850 ms open/close.
- **Layers used:** unit (store, copy, sound module), component/e2e in browser (reader).

### Test list

**Store — `src/lib/stores/bookStore.spec.ts`**

| ID  | Layer | Test name                                                                                                        | Asserts                                                                                                                                                            |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | unit  | `nothing lies before the cover` (updated)                                                                        | at the cover (first position), in spread and single mode: `prev()` pends nothing and the position is unchanged                                                     |
| T2  | unit  | `going forward from the back cover returns to the front cover` (updated)                                         | at the back cover (last position), in spread and single mode: `next()` pends the cover position with direction `prev`; committing lands on the cover               |
| T3  | unit  | `a turn inside the book still only turns the page`                                                               | from a middle position `next()` and `prev()` pend a turn and the book stays `opened`                                                                               |
| T4  | unit  | `every page turn plays the paper sound` (updated)                                                                | `next()` in spread and in single mode call `playPaperFlipSound('next')`, `prev()` calls it with `'prev'`; turning the cover (first → second position) plays it too |
| T5  | unit  | `opening and closing the book play the paper sound` (removed: opening and closing are page turns, covered by T4) | —                                                                                                                                                                  |

**Sound module — `src/lib/audio/sfx.spec.ts` (new)**

| ID  | Layer | Test name                          | Asserts                                                   |
| --- | ----- | ---------------------------------- | --------------------------------------------------------- |
| T6  | unit  | `the paper flip is the only sound` | the module's exports are exactly `['playPaperFlipSound']` |

**Copy — `src/lib/data/bookCopy.spec.ts`**

| ID  | Layer | Test name                                              | Asserts                                                                                                             |
| --- | ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| T7  | unit  | `bookUiCopy has only the labels the bare reader needs` | groups are exactly `experience` and `reader`; no blank strings; `reader` has the previous-page and next-page labels |

**Reader — `src/lib/components/book/BookScene.svelte.spec.ts`**

| ID  | Layer   | Test name                                                                             | Asserts                                                                                                                                                                                               |
| --- | ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T8  | browser | `the closed book shows only its cover` (updated)                                      | first position: the cover is the only image shown; exactly one button, "Abrir a HQ"; no text; the cover's centre is within 2 px of the stage's horizontal centre                                      |
| T9  | browser | `the open book shows only its pages` (updated)                                        | at a story spread: the only buttons are "Página anterior" and "Próxima página"; no heading, dialog, counter or progress bar; no text                                                                  |
| T10 | browser | `clicking the right page goes forward and the left page goes back`                    | spread mode: click in the middle of the right page → spread 1 (pages 3–4 shown); click in the middle of the left page → spread 0                                                                      |
| T11 | browser | `on a phone the right half goes forward and the left half goes back` (updated)        | single mode on story page 1: click on the right half → page 2; click on the left half → page 1; each step mounts a turning leaf and never a sliding track                                             |
| T12 | browser | `clicking outside the pages does nothing`                                             | click on the background beside the pages → position unchanged, book still `opened`                                                                                                                    |
| T13 | browser | `going back from the first spread closes the book on its cover` (updated)             | first story spread, click the left page → a leaf turns and the position settles on the cover alone, centred on the stage                                                                              |
| T14 | browser | `after the last spread comes the back cover` (updated)                                | last story spread, click the right page → only the back cover is shown (named "Contracapa"), centred; clicking it returns to the last spread; ArrowRight on the back cover returns to the front cover |
| T15 | browser | `arrow keys turn the page and Escape returns to the cover` (updated)                  | ArrowRight from the cover → first spread; ArrowRight → second; ArrowLeft → first; Escape → the cover                                                                                                  |
| T16 | browser | `a horizontal swipe turns the page on a phone` (updated: steps are flips, not slides) | single mode: drag left ≥ 48 px → next; drag right → prev; vertical drag → nothing; the click after a swipe does not turn a second page                                                                |
| T17 | browser | `a two-finger gesture never turns the page`                                           | single mode: two pointers down, one moves 100 px sideways, both lift → position unchanged                                                                                                             |
| T18 | browser | `nothing enlarges a page`                                                             | clicking and double-clicking a page never opens a dialog; no control named "Ampliar" exists                                                                                                           |
| T19 | browser | `the pages use the whole screen`                                                      | 1280×800 viewport, spread mode: the spread is at least 92% of the viewport height (no strip reserved for chrome)                                                                                      |
| T20 | browser | `the stage is bright`                                                                 | computed background colour of the scene has relative luminance ≥ 0.7; no firefly elements are rendered                                                                                                |

**Cover and back cover as leaves (update 2026-11-22)**

| ID  | Layer   | Test name                                                 | Asserts                                                                                                                                                                              |
| --- | ------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T21 | unit    | `the book is the cover, 14 pages and the back cover`      | `bookFaces(comic)` lists 16 faces in order: the cover, story pages 1–14, the back cover; laid out for spreads the cover sits alone on the right and the back cover alone on the left |
| T22 | unit    | `a phone walks every face once and skips the empty sides` | single mode from the cover: 15 `next()` + commit steps visit page 1 … page 14 and end on the back cover, never resting on an empty side; 15 `prev()` steps walk back to the cover    |
| T23 | unit    | `goToCover turns straight back to the cover`              | from a middle position `goToCover()` pends the cover with direction `prev`; at the cover it does nothing; ignored mid-turn                                                           |
| T24 | browser | `the cover opens like a page`                             | spread mode at the cover: click it → a turning leaf is mounted whose front face is the cover art; it settles on "Sumário" + "Introdução" with the spread centred on the stage        |
| T25 | browser | `on a phone the cover and every page flip`                | single mode at the cover: click → a turning leaf carries the cover and the view settles on "Sumário"; no `.slide-track` element exists at any point                                  |
| T26 | browser | `keyboard focus stays on the forward area`                | forward comes first in tab order ("Abrir a HQ" on the cover, "Próxima página" after); after turns with Enter the same element is still focused, including across the cover           |
| T27 | browser | `the back cover is drawn in the cover's colours`          | at the last position the back cover has a dark background (relative luminance ≤ 0.1), no text, and the same size as a page                                                           |

**Kept unchanged (must stay green):** cover art eager/high priority, two page images per spread with the leaf turn, one page image on a phone, only visible pages mounted; all pipeline, asset, `pageScale`, `comic` cover/pages/alt/`pageSources`/`pagesToPreload` tests; store position, view-mode, open/close and persistence tests.

**Tests removed with their feature**

| From                         | Test                                                                                                                                             | Why                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| hq-parque-mil-olhos T14      | `lists the 12 chapters of the Sumário`                                                                                                           | Sumário removed; `comic.chapters` deleted                                              |
| hq-parque-mil-olhos T30, T31 | zoom opens/closes; no turns while zoomed                                                                                                         | zoom removed                                                                           |
| hq-parque-mil-olhos T32      | Sumário lists chapters and jumps                                                                                                                 | Sumário removed                                                                        |
| `BookScene.svelte.spec.ts`   | mouse drag pans the enlarged page; Escape in the Sumário closes only the Sumário                                                                 | zoom and Sumário removed                                                               |
| `bookStore.spec.ts`          | `goToPage` (6 tests), `progress` (2 tests)                                                                                                       | only the Sumário and the footer used them                                              |
| `bookStore.spec.ts`          | `cannot go back on the first spread`, `cannot go past the last spread`, `cannot step back past the first page`, `cannot step past the last page` | replaced by T1 and T2                                                                  |
| `bookCopy.spec.ts`           | `fillCopy` cases that use the `toc` and `zoom` templates                                                                                         | those groups are deleted; the cases move to the remaining templates                    |
| `bookStore.spec.ts`          | `open/close lifecycle` (4 tests) and the open/close parts of `view mode`                                                                         | update 2026-11-22: the closed/opening/closing states are gone; the cover is a position |
| hq-parque-mil-olhos T26      | `shows one page image on a phone and slides to the next`                                                                                         | update 2026-11-22: phone steps flip; replaced by T11 and T25                           |
| `BookScene.svelte.spec.ts`   | `keyboard focus follows the book as it opens and closes` (never added)                                                                           | replaced by T26                                                                        |

## 2. Business Rules

| ID  | Rule                                                                                                                                                                                               | Tests                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| R1  | The screen shows only the book: on the cover, the cover; inside, the pages; at the end, the back cover. No title, Sumário, sound, close, previous/next buttons, counter or progress bar. (updated) | T8, T9, T14            |
| R2  | Clicking the left page goes back; clicking the right page goes forward. On a phone the left and right halves of the single page do the same.                                                       | T10, T11               |
| R3  | Clicks outside the pages do nothing.                                                                                                                                                               | T12                    |
| R4  | The cover is the first leaf of the book: turning back from the first spread closes the book on its cover, and nothing lies before the cover. (updated)                                             | T1, T13                |
| R5  | The back cover is the last leaf: turning forward from the last spread shows it alone, and going forward from it returns to the front cover. (updated)                                              | T2, T14, T27           |
| R6  | Arrow keys and, on a phone, horizontal swipes still turn pages; Escape returns to the cover. (updated)                                                                                             | T15, T16, T23          |
| R7  | The paper sound is the only sound. It plays on every turn, the covers included. It cannot be switched off in the app. (updated)                                                                    | T4, T6                 |
| R8  | No app feature enlarges a page; the browser's own pinch zoom works on the pages and never turns one.                                                                                               | T17, T18               |
| R9  | The pages fill the screen; no space is reserved for controls.                                                                                                                                      | T19                    |
| R10 | The stage is a bright warm parchment tone with no fireflies.                                                                                                                                       | T20                    |
| R11 | The only interface copy left is the accessible labels for the cover and the two page areas.                                                                                                        | T7, T9                 |
| R12 | Opening and closing are page turns: the cover turns as a leaf, on desktop and on a phone, and a closed book rests centred on the stage.                                                            | T8, T13, T14, T24, T25 |
| R13 | The book is the cover, the 14 story pages and the back cover, each shown exactly once.                                                                                                             | T21, T22               |
| R14 | Keyboard focus is never lost when a page or cover turns.                                                                                                                                           | T26                    |

## 3. Behaviour Changes

| Area                        | Before                                                                          | After                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Header                      | Sumário button, title + chapter name, sound toggle, close (X)                   | Removed                                                                                |
| Footer                      | Anterior / Próxima buttons, page counter, keyboard hint, progress bar           | Removed                                                                                |
| Turning pages (mouse/touch) | Outer 18% (spread) or 28% (phone) margins turn; the middle enlarges             | Whole left page = back, whole right page = forward; on a phone, left half / right half |
| First page, going back      | Nothing                                                                         | Book closes to the cover                                                               |
| Last page, going forward    | Nothing                                                                         | Book closes and rewinds to the first page                                              |
| Sumário                     | Modal with 12 chapters                                                          | Removed (the illustrated Sumário page is still page 1)                                 |
| Zoom                        | Magnifier button per page, tap-to-enlarge dialog                                | Removed; phones can pinch-zoom natively                                                |
| Sound                       | Paper flip on spread turns only, plus open, close and click sounds; mute toggle | Paper flip on every turn (spread and phone) and on open/close; no toggle               |
| Background                  | Night navy with lantern glow and fireflies                                      | Warm parchment, no fireflies                                                           |
| Cover                       | Cover + pill hint "Toque na capa para entrar no parque"                         | Cover only                                                                             |
| Page size                   | Space kept for header, footer and hint                                          | Pages use the full viewport with a small margin                                        |
| Keyboard                    | Arrows turn, Escape closes                                                      | Same                                                                                   |

**Update 2026-11-22**

| Area                   | Before                                                 | After                                                                                       |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Opening the book       | Click the cover; it zooms and dissolves, pages fade in | Click the cover; it turns like a page and the first spread lies open                        |
| Closing the book       | Pages fade out, cover fades back                       | Turning back from the first spread turns the first leaf back onto the cover                 |
| End of the book        | Forward from the last spread closes and rewinds        | Forward from the last spread shows the back cover; forward again returns to the front cover |
| Closed book on desktop | Cover centred, separate from the spread                | Same book: the cover is the right half of the spread, slid to the centre while it is closed |
| Phone page turns       | Pages slide sideways                                   | Pages flip around their left edge, covers included                                          |
| Escape                 | Closes with a fade                                     | Turns straight back to the cover                                                            |
| Return visit           | Reopens where the reader stopped                       | Same (the cover and back cover count as positions too)                                      |

## 4. Technical Implementation

- **Files touched:**
  - Modified: `src/lib/stores/bookStore.svelte.ts` (ends close the book, rewind, sound on every turn and on open/close; drop `audioEnabled`, `toggleAudio`, `isTableOfContentsOpen`, `toggleTableOfContents`, `goToPage`, `isPageVisible`, `progressPercent`, `canGoPrev`, `canGoNext`), `bookStore.spec.ts`.
  - Modified: `src/lib/audio/sfx.ts` (keep only `playPaperFlipSound` and what it needs); new `sfx.spec.ts`.
  - Modified: `src/lib/components/book/BookScene.svelte` (no header/footer/modal/zoom; two page-area buttons; full-viewport scale; parchment stage), `BookScene.svelte.spec.ts`, `BookCover.svelte` (shadow for a light stage), `BookSpread.svelte`, `BookSinglePage.svelte` (shadows), `swipe.ts` (ignore multi-pointer gestures).
  - Modified: `src/lib/data/uiCopy.ts`, `bookCopy.spec.ts`, `comic.ts` + `comic.spec.ts` (drop `chapters`), `src/lib/types/book.ts`, `src/lib/index.ts`, `src/routes/layout.css` (drop `.chrome-btn`), `src/app.html` (light theme colour and body background).
  - Deleted: `src/lib/components/ui/BookHeader.svelte`, `BookFooter.svelte`, `TableOfContentsModal.svelte`, `TableOfContentsModal.svelte.spec.ts`, `src/lib/components/book/PageZoom.svelte`, `Fireflies.svelte`.
- **Reused:** the store's position/transition model and persistence; leaf turn and slide; cover open animation; `swipe` action and its click-swallowing; `fitScale`, `viewModeFor`, `imageSizes`; preload of the next turn.
- **Design:**
  - _Two transparent buttons over the pages_ ("Página anterior", "Próxima página"), each covering one half of the book: gives the click areas, keyboard focus and screen-reader names in one place, with no visible chrome.
  - _End-of-book behaviour lives in the store_ (`prev()` / `next()`), so clicks, arrow keys and swipes all behave the same.
  - _Rewind after the close animation_, so the pages do not jump while they fade out.
  - _`touch-action: pan-y pinch-zoom`_ on the reading area, and the swipe action tracks one pointer only, so a pinch is left to the browser.
- **Dependencies:** none. `@fontsource/pixelify-sans` is removed if no text is left that uses it.

- **Update 2026-11-22:**
  - New `bookFaces(comic)` in `comic.ts`: the ordered faces (cover, pages, back cover) padded with one empty side at each end, so the store's existing spread pairing puts the cover alone on the right and the back cover alone on the left.
  - New `BackCover.svelte` (drawn in CSS); `BookCover.svelte` is deleted, the cover is rendered by `ComicPage` like any page.
  - `bookStore`: `bookUIState`, `openBook`, `closeBook` removed; `goToCover` added; steps skip empty sides.
  - `BookSpread.svelte` slides the frame a quarter-spread sideways at either end; `BookSinglePage.svelte` turns a single leaf instead of moving a track.

## 5. Considerations

- **Assumptions:**
  - Answers given: zoom is pinch only (no app zoom); background is warm parchment; both ends of the book close it.
  - The paper sound also plays on phone page turns and when the book opens or closes.
  - The "Toque na capa…" hint under the cover is removed with the rest of the text; the cover keeps its pointer cursor and hover glow.
  - Reopening the book returns to the last-read page, except after finishing it (rewound to the start).
  - The cover-opening animation (zoom through the gate) stays.
- **Update 2026-11-22:**
  - Answers given: back cover is plain, in the cover's colours; phones flip too; the book reopens where the reader stopped; S1–S5 ticked.
  - The cover image is slightly taller than a page (0.71 vs 0.75), so as a leaf it is cropped about 2.7% at the top and bottom.
  - In spread mode the empty half beside a closed cover is not clickable; on the back cover the forward step is the right arrow key (or, on a phone, the right half and a swipe).
- **Edge cases:**
  - Clicks during a turn are ignored, as today, so a double click turns one page.
  - A click that ends a swipe is swallowed, so a swipe never turns two pages.
  - While pinch-zoomed, a one-finger drag pans the browser view; swipes are ignored until the view is back at normal scale.
  - Reduced motion: turns and open/close stay instant, unchanged.
- **Risks:**
  - With no hint and no buttons, a first-time reader must discover that the cover and the pages are clickable. Cursor and hover feedback are the only cues.
  - There is no in-app mute; readers silence the tab or the device.
  - Jumping to a chapter is no longer possible; reaching the last page takes 7 clicks on desktop, 14 on a phone.
  - Small lettering on phones now depends on pinch zoom.
- **Out of scope:** changing the art or the images; a settings menu; chapter navigation; the `AD/` docs.

## 6. Steps

- [x] S1: Store — the ends of the book close it, forward from the last page rewinds (T1, T2, T3)
  - Tests T1–T3 plus `does not reopen while closing`, odd page count, rewind stored at once (added after review) in `bookStore.spec.ts`; file `bookStore.svelte.ts`. Reviewed with S2–S5: 1 round, 5 blocking findings; 4 fixed, 1 (focus after open/close) superseded by S7.
- [x] S2: Sound — paper flip only, on every turn and on open/close; remove the other sounds and the mute state (T4, T5, T6)
  - Tests T4–T6 in `bookStore.spec.ts` and `sfx.spec.ts`; files `bookStore.svelte.ts`, `sfx.ts`.
- [x] S3: Prune — remove Sumário, progress, zoom and audio from the store, data, types and copy; delete their tests (T7)
  - Test T7 in `bookCopy.spec.ts`; files `uiCopy.ts`, `types/book.ts`, `comic.ts`, `comic.spec.ts`, `index.ts`; removed the Sumário, progress and zoom tests listed above.
- [x] S4: Reader — page-area buttons, no header/footer/modal/zoom, full-viewport pages, pinch-safe swipe; delete the unused components (T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19)
  - Tests T8–T19 in `BookScene.svelte.spec.ts` (T16, T17, T19 strengthened after review); files `BookScene.svelte`, `swipe.ts`, `BookSinglePage.svelte`; deleted `BookHeader`, `BookFooter`, `TableOfContentsModal` (+spec), `PageZoom`, `Fireflies`; dependency `@fontsource/pixelify-sans` removed. S1–S4 were written as one pass.
- [x] S5: Look — parchment stage, light-stage shadows, no fireflies or hint, light theme colour; check the production build at 1440×900 and 390×844 (T20)
  - Test T20; files `BookScene.svelte`, `BookCover.svelte`, `BookSpread.svelte`, `ComicPage.svelte`, `PageLeaf.svelte`, `layout.css`, `app.html`. Also done here on request: spine shadow and crease where the pages meet; fix for a one-frame blank leaf face mid-turn (faces load eagerly, decode before paint, swap by opacity), confirmed by capturing every painted frame of three turns. Checked on the production build at 1440×900 and 390×844.

- [ ] S6: rework S1 — the store has no closed/opening/closing states: the cover and back cover are the first and last positions; `goToCover`; phone walk skips empty sides (T1, T2, T4, T21, T22, T23)
  - Implemented, tests green (80 passing), checked in Chromium at 1440×900 and 390×844; committed at the user's request before the review round, which is still to run.
- [ ] S7: rework S4 — cover and back cover as leaves in spread mode: `bookFaces`, drawn back cover, closed book centred, forward-first focus (T8, T9, T13, T14, T15, T24, T26, T27)
  - Implemented, tests green (80 passing), checked in Chromium at 1440×900 and 390×844; committed at the user's request before the review round, which is still to run.
- [ ] S8: rework S4 — phone steps flip instead of slide, covers included (T11, T16, T25)
  - Implemented, tests green (80 passing), checked in Chromium at 1440×900 and 390×844; committed at the user's request before the review round, which is still to run.

## 7. Updates

| Date       | Change                                                                                                                                                                                                             | Sections touched                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22 | Cover and back cover become leaves of the book: opening and closing are page turns; a drawn back cover in the cover's colours; phone steps flip instead of slide; the book still reopens where the reader stopped. | TDD (T1, T2, T4, T8, T9, T11, T13–T16 updated; T5 removed; T21–T27 new), Business Rules (R1, R4–R7 updated; R12–R14 new), Behaviour Changes, Technical Implementation, Considerations, Steps (S6–S8) |
