# 2D Top-Down Book UI — Refactor Plan

## 0. Context & Goal

I tried a 3D version with three.js but it seems flaky & hard to run on mobile, I'm thinking on other ways to represent the books.

One thing I want to maintain is the book view, the feel of a real book. I think it's important for the user to feel like he's reading a real book, with pages that can be turned and a cover that can be admired.

The idea now is to have the book done with CSS & the view be top down:

1. Book closed — user can click to open. (Cover stays the same as the old version.)
2a. Book open on desktop — the view shows both pages & when the user clicks, it leafs to the next 2 pages.
2b. Book open on mobile — the view zooms on the first page (left) & when the user clicks next, the view goes to the second page (right); clicking next again leafs to the next two pages (3 & 4), etc. "Back" leafs to the previous two pages, etc.

**Goal of this document:** turn the above into a buildable spec — mechanics, state model, component breakdown, and roadmap. The 3D engine (`three.js` + `pageTexture`/`pageGeometry`/`pageStack`/`hitProjection` + `Book3DExperience` + `PageInteractionLayer`) is **removed entirely**; the version stays in git history if ever needed.

---

## 1. Decisions (agreed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Desktop flip leaf | **Right page only.** P2 rotates 180° around the spine, lands on P1, reveals P4. Leaf faces: P2 content on top, P3 content on the underside. |
| 2 | Flip animation | **CSS `rotateY` hinge + moving shadows/edge-lighting.** No page curl. Transforms + composites only — cheap on mobile. |
| 3 | Mobile within-spread move | **Slide, no flip.** P1→P2 is a horizontal slide/pan. Flips only at spread boundaries (P2→P3, P4→P5, …). |
| 4 | Mobile "back" | **Exact inverse of the last "next".** P3→P2 is a flip back; P4→P3 is a slide. |
| 5 | Navigation controls | **Corner buttons + outer-margin tap zones.** In-page interactive elements are DOM buttons and never trigger navigation. |
| 6 | Mode breakpoint | **768px (`md`).** Two-page spread above 768px, single-page below. |
| 7 | Cover | **Recreated in DOM/CSS/SVG** — linen grain via CSS/SVG noise, gold foil via gradients. Crisp at any size, visually equivalent to the old procedural texture. |
| 8 | Closed scene | **Keep ambience + hover tilt.** Warm background, drop shadow, slight thickness, mouse-parallax tilt (the "admire the cover" moment). |
| 9 | Close-book affordance | **Small button in the chrome + `Esc`.** |
| 10 | Page content | **Live DOM** — real selectable text, accessible markup, real `<button>`s. No baked canvas textures. |
| 11 | Layout model | **Fixed design-size page box, `transform: scale()` to fit** the viewport. The "paper" keeps its proportions and type size on every device. |
| 12 | Gutter | **Yes** — subtle central fold shadow on the desktop spread. |
| 13 | Position persistence | **`{ spread, side }`.** Desktop saves the spread only; mobile saves spread + side. |
| 14 | TOC jump | **Opens the spread containing the target page; on mobile lands on the chosen side.** |
| 15 | Keyboard | **Desktop: arrows = whole spreads. Mobile: arrows = one step at a time.** |
| 16 | three.js | **Removed**, with all 3D-only modules. |
| 17 | Chrome | **Keep all:** TOC modal, audio toggle, paper-flip / open / close SFX. |

---

## 2. Views & States

The reader has three UI states:

1. **Closed** — top-down closed book on the warm scene, hover-tilt, "click to open" affordance.
2. **Open, spread mode** (viewport ≥ 768px) — two-page spread, both pages visible.
3. **Open, single mode** (viewport < 768px) — one page zoomed to fill the viewport.

Plus, within open states:

- **Flipping** — the leaf is mid-animation (input locked, exactly one active flip).
- **Opening / closing** — the cover transition is in flight.

State machine:

```
closed --click/Esc? no--->  opening  -->  opened (spread or single, by width)
opened --close btn/Esc---->  closing  -->  closed
opened --next/prev (spread)--> flipping(forward|backward) --> opened (new spread)
opened --next/prev (single)  --> slide | flipping --> opened (new position)
```

Resizing across the 768px breakpoint while open swaps spread/single mode **without** a flip: the position `{ spread, side }` is unchanged; single mode shows `side` of `spread`.

---

## 3. Book Geometry & Scaling

- 12 content pages ⇒ 6 spreads: (1,2), (3,4), (5,6), (7,8), (9,10), (11,12).
  - Left page of a spread = odd page, right page = even page.
  - Data model invariant: page count must be even; if it ever becomes odd, append a blank verso page (design decision, not computed ad hoc).
- **Design page box:** `512 × 720` CSS units (aspect 0.711 — matches the old 1024×1440 texture ratio). All page content is designed in this box.
- **Spread box:** `512·2 + 8` gutter = `1032 × 720`.
- **Scaling:** the page/spread wrapper is scaled with `transform: scale(s)` (GPU-composited, no layout):
  - Spread mode: `s = min((vw − chromeH) / 1032, (vh − chromeV) / 720)`
  - Single mode: `s = min((vw − chromeH) / 512, (vh − chromeV) / 720)`
  - `chromeH/V` = space reserved for header/footer/corner buttons.
- Because the box is fixed, typography is identical on every device; only the scale changes.

---

## 4. Cover (Closed State)

Recreated in DOM/CSS/SVG from the old procedural design (`bookCoverTexture.ts` is the visual reference):

- Dark slate linen base: layered gradients + SVG feTurbulence noise (or a small generated tile) for the grain.
- Gold foil frame: double border (4px + hairline), corner accents, via CSS/SVG with gradient "foil" fills.
- Spotlight/eye motif: **rings are SVG `<circle>` strokes, not CSS borders.** A dashed CSS border on a `border-radius: 50%` circle rasterizes through a border path that breaks apart under the cover's 3D tilt — dashes drop out in long dead zones and smear elsewhere. SVG `stroke-dasharray` is stable under transforms and fractional scaling.
- **Two-faced leaves never use `backface-visibility`.** Chromium decides an element's facing from *its own* transform, so the face carrying the 180° pre-rotation gets culled even while it is the one turned toward you, while the face with no pre-rotation is never culled — you see the outgoing page (or the cover art) mirrored on the back. Both faces of `PageLeaf` and of the cover leaf swap by `visibility` instead, keyed to a **symmetric** easing so the swap lands exactly on the edge-on moment (50% of the animation = 90°), where neither face is visible anyway. Faces also take `pointer-events: none` so a turning leaf never swallows a tap.
- Title/subtitle/author in the same serif type and layout as the old texture (copy comes from `bookMeta.cover`).
- **Scene:** warm `#EAE6DF`-family background, soft large drop shadow under the book, a sliver of "book block" thickness at the bottom/right edge to sell physicality.
- **The cover is the book's first leaf:** front face = the cover art, back face = blank cream paper (the reverse of that leaf, shaded toward the spine, with the shadow of the cover now lying face-down). It is built like `PageLeaf` — two `backface-visibility: hidden` faces, back pre-rotated 180° — so opening the book turns a real leaf over instead of fading a card out.
- **Where it rests (the spine rule):** the spine never moves, and a closed book is one page wide while an open spread is two — so in spread mode the closed book sits on the spread's **right half**, its spine edge landing exactly on the future gutter (the viewport centre line). That is the only placement where the cover can swing left across the desk honestly. In single mode the reading page already occupies the book's own footprint, so the book stays centred there and the cover simply swings off to the left.
- **Same book, not a second card:** the closed cover uses the **same scale** as the open pages (one page tall = half the spread wide), and the chrome stays mounted (hidden + `inert`) while closed so both states share one framing. The "click to open" hint occupies a reserved strip below the book in *both* states, so opening never changes the book's size or position.
- **Hover tilt (pointer devices only):** pointer position maps to small `rotateX/rotateY` (±~4°) on a `perspective` container, eased/lerped for smoothness. Disabled on touch.
- **Interaction:** click anywhere on the book (or Enter/Space) → open.

---

## 5. Open / Close Transitions

**Two honest beats, one fixed spine.** Nothing is faked except the camera: the cover swings about the spine, page 01 splays about that same spine onto the cover it lies on, and page 02 is revealed underneath — exactly how a real book rests open.

**Open (~850ms, matching the store's `OPEN_DURATION`):**

| Beat | Window | What happens |
|---|---|---|
| 1 — the cover | 0–360ms | The cover leaf turns about its **left edge** (the spine): `rotateY` 0 → −180°, perspective foreshortening, landing face-down on the left half. Its blank back is what shows past 90°. |
| — | 0–260ms | The hint pill fades away. |
| — | 280–460ms | The cover dissolves once it has landed, so it is gone before the splay arrives. |
| 2 — the splay | 330–650ms | Page 01 turns about the **gutter** (`rotateY` 180° → 0°, `transform-origin: right center`, backface hidden so no mirrored text shows) and lands on the cover; page 02 fades in on the right half. |
| 3 — handoff | 650–850ms | The live spread is in place and interactive; the store flips to `opened` and the closed layer unmounts. |

Because the cover has faded out before page 01 becomes visible, the two never stack up: at no instant does the book read as three pages, and nothing ever slides across the desk except leaves turning about the spine.

**Close:** the exact inverse — the spread fades out (0–330ms), then the cover fades in and swings shut (−180° → 0°, 330–690ms).

- `playBookOpenSound()` / `playBookCloseSound()` on start.
- During the transition, navigation input is disabled and the store moves `opening`/`closing` → `opened`/`closed` (store drives it, CSS animation runs the visuals; no per-frame rAF needed).
- Close affordance: small "close book" button in the header chrome (alongside TOC/audio) + `Esc`.
- **Reduced motion:** the layer swap is instant — the layer that would sit on top is simply not rendered.
- **Optional polish (later phase):** show a sliver of the open front cover at the left edge of the spread. Nice-to-have, out of scope for the first cut.

---

## 6. Page Flip Mechanic (Spread Mode)

### DOM structure

```
.book-scene (perspective)
└── .spread (1032×720, scaled)
    ├── .page.page--left
    │   ├── .page-stack--prev   (edge shading of read pages beneath)
    │   └── PageView(left)      (e.g. P1)
    ├── .gutter (central fold shadow)
    ├── .page.page--right
    │   ├── .page-stack--next   (edge shading of unread pages beneath)
    │   └── PageView(right)     (top right page)
    └── .leaf (absolute, spans the right half, transform-origin: left center = spine)
        ├── .leaf-face--front   (backface-hidden) → current RIGHT page (P2)
        └── .leaf-face--back    (backface-hidden, pre-rotated 180°) → next LEFT page (P3)
```

### Forward flip, spread (2i+1, 2i+2) → (2i+3, 2i+4)

1. Mount `.leaf`: front face = P2 content, back face = P3 content.
2. Right slot immediately shows P4 (the leaf covers it while flat).
3. Animate `rotateY: 0 → 180°` (~600–700ms, ease-in-out), sign chosen so the leaf lifts **toward the viewer** (out of the table) — reads naturally from above.
4. Shadow choreography (all CSS):
   - Growing gutter shadow across the leaf's top face toward the spine as it rotates.
   - Soft shadow on P1 (landing zone) easing in during the second half.
   - Slight lift/drop shadow on the leaf edge during the first half.
5. On completion: unmount `.leaf`, spread re-renders as (P3, P4); left stack gains P3, right stack's top becomes P4.

### Backward flip

Inverse: `.leaf` front = current left page P3, back = previous right page P2, hinge on the spine, rotates 180° back onto the right; the right slot's top page becomes P2 underneath.

### Rules

- One flip at a time; `next`/`prev`/arrows ignored while flipping (`isFlipping`).
- Page-edge stacks (`.page-stack--prev/--next`) are static CSS (1–2 repeating gradient lines + inner shadow) — no per-page DOM for buried pages.
- Reduced motion (`prefers-reduced-motion`): swap flip for a short crossfade between spreads.

---

## 7. Mobile Single Mode

One page at a time, page box scaled to fill the viewport. Position = `{ spread, side }`.

- **Next:**
  - `side = left` → slide right to `side = right` (no flip). `playPaperFlipSound` not played — a softer slide cue or nothing (decide in SFX pass).
  - `side = right` → **flip** to next spread, land `side = left`. Leaf front = current page, back = next spread's left page; hinge on the page's **left edge** (its spine).
- **Back (exact inverse):**
  - `side = right` → slide back to `side = left`.
  - `side = left` → **flip** to previous spread, land `side = right`. Leaf front = current page, back = previous spread's right page; hinge on the page's **right edge**.
- **Hinge edges:** left pages (odd) have the spine on their right edge; right pages (even) on the left. Slide/flip animations use the correct hinge for the page leaving.
- **Slide animation:** `translateX` of the two pages in a shared viewport, ~300–350ms ease-out; subtle edge shadow on the incoming page.
- **Flip animation:** same CSS hinge system as spread mode (§6), single-page sized.

---

## 8. Navigation & Input

| Input | Spread mode (≥768px) | Single mode (<768px) |
|-------|---------------------|----------------------|
| Corner/edge buttons | next/prev spread | next/prev step |
| Margin tap zones | outer ~20–25% of right page → next; of left page → prev | right outer margin → next; left outer margin → prev |
| `→` / `PageDown` | next spread | next step |
| `←` / `PageUp` | prev spread | prev step |
| `Enter`/`Space` (closed) | open | open |
| `Esc` (open) | close book | close book |
| TOC jump | open spread containing target | open spread + land on target side |

- **Disambiguation:** pointer handlers check `event.target.closest('button, a, [data-interactive]')` first — in-page interactive elements (dilemma choices etc.) never navigate. Only margin zones and corner buttons navigate.
- Buttons respect `canGoPrev`/`canGoNext` (disabled at bounds and while flipping).
- TOC modal, audio toggle: unchanged behavior, re-wired to the new store.

---

## 9. Page Content Rendering (Live DOM)

- `PageView` renders one page's content from `BasePageData` into the fixed 512×720 box:
  - `cover` (unused inside the book — cover is the closed state), `standard`, `index`, `references`, `authors` — each an archetype in `PageContentRenderer` (adapting the existing DOM renderer, no canvas baking).
  - Page header: running chapter title + page number top-right (`01 / 12`, omitted on the cover).
  - Paper background: `#FDFBF7`-family flat sheet with a very subtle CSS grain (same texture trick as the cover, lighter).
- Interactivity: dilemma choices / callouts are real `<button>`s inside the page; answers recorded via `bookStore.selectOption(pageId, optionId)` (existing behavior, now DOM-native — no hit-region projection).
- Text stays selectable; pages are focusable regions with sensible `aria-label`s (page N of 12, title).

---

## 10. Chrome

Carried over, DOM overlays outside the scaled book area:

- **BookHeader:** TOC button · book title (+ current chapter) · audio toggle · **new: close-book button**.
- **BookFooter:** prev/next buttons (labels adapt: "Next page" vs. "Next spread" copy — or keep generic), page counter, progress bar.
  - Progress in single mode = page position (0..12); in spread mode = spread position (0..6) mapped over the same bar.
- **TOC modal:** entries jump via §8 rules.
- **SFX:** keep `playPaperFlipSound` (flips only), `playBookOpenSound` / `playBookCloseSound`, `playSoftClickSound` (choices, toggles). Mute toggle persisted as today.

---

## 11. State Model (`bookStore.svelte.ts` — reworked)

```ts
class BookStore {
  // Position (replaces currentPageIndex)
  spreadIndex = $state(0)          // 0..5
  side: 'left' | 'right' = $state('left')  // mobile refinement

  // View
  mode: 'spread' | 'single'        // derived from viewport width (768px), tracked by the Book scene
  bookUIState: 'closed' | 'opening' | 'opened' | 'closing'
  isFlipping = $state(false)
  flipDirection: 'next' | 'prev'   // for SFX + leaf mounting

  // Unchanged
  selectedOptions, audioEnabled, isTableOfContentsOpen
  // derived
  canGoPrev / canGoNext            // bounds + !isFlipping + opened
}
```

- `next()` / `prev()`:
  - spread mode: `spreadIndex ± 1` (flip).
  - single mode: one step (§7 rules — slide or flip).
- `goToPage(pageIndex)`: `spreadIndex = floor(index/2)`, `side = index % 2 ? 'right' : 'left'`; animates a flip when the spread changes (or a fast crossfade for large jumps — decide in polish; first cut: single flip regardless of distance).
- Persistence (`localStorage`): `{ spread, side }` (replaces `plateia_page_index`); on load, spread mode ignores `side`, single mode honors it. Migration: read old `plateia_page_index` once and map to spread.
- `book_open` flag, audio flag, options: unchanged.
- Flip completion: store sets `isFlipping=false` on animation end (CSS `animationend`/`transitionend` listener in the scene component, or a duration timer as today). No per-frame `flipProgress` state in the store anymore — the animation is CSS-driven.

---

## 12. Component Breakdown

### New

```
src/lib/components/book/
├── BookScene.svelte        # Master: mode, open/close, scene framing, input routing
├── BookCover.svelte        # Closed cover: DOM/CSS/SVG art, hover tilt, click-to-open
├── BookSpread.svelte       # Two-page spread, gutter, page-edge stacks, flip orchestration
├── BookSinglePage.svelte   # Mobile single-page viewport: slide + boundary flips
├── PageLeaf.svelte         # The flipping leaf (front/back faces, shadow overlays, CSS animation)
├── PageView.svelte         # One 512×720 page: paper bg, header/number, scaled content
└── pageScale.ts            # Shared scale math for spread/single boxes (+ spec)
```

### Adapted

- `PageContentRenderer.svelte` — keep the DOM rendering for the 5 page archetypes; drop canvas-texture coupling.
- `BookHeader.svelte` / `BookFooter.svelte` / `TableOfContentsModal.svelte` — rewire to the new store (spread/step semantics, close button, progress source).
- `bookStore.svelte.ts` — rework per §11 (keep SFX hooks).
- `sfx.ts` — keep; possibly add a soft "slide" variant for within-spread moves.
- `+page.svelte` — render `BookScene` instead of `Book3DExperience`.

### Removed

- `Book3DExperience.svelte`, `PageInteractionLayer.svelte`
- `pageTexture.ts` (+spec), `pageGeometry.ts` (+spec), `pageStack.ts` (+spec), `hitProjection.ts`
- `bookCoverTexture.ts`, `deskTexture.ts`
- `three` dependency (and any three-only types)

---

## 13. Performance & Accessibility Notes

- Everything animatable is transform/opacity (composited). No per-frame JS during flips; the render loop from the 3D version disappears.
- Live DOM text = crisp at any DPR, selectable, zoomable, screen-reader friendly; in-page buttons are native focusable controls.
- `prefers-reduced-motion`: crossfade instead of flips/slides; no hover tilt.
- Keyboard: full arrow/Esc/Enter coverage per §8; TOC modal keeps its Esc behavior and focus trapping.
- Bundle: three.js removed → significant payload drop (expected to remove the heaviest chunk by far).

---

## 14. Phased Roadmap

- [x] **Phase 1 — Store rework:** `{ spread, side }` model, mode-aware `next()/prev()/goToPage()`, persistence (+ migration from old key), tests in `bookStore.spec.ts`.
- [x] **Phase 2 — Page system:** `pageScale.ts`, `PageView`, `PageContentRenderer` for all archetypes in the fixed 512×720 box; verify type/layout across the 12 pages.
- [x] **Phase 3 — Cover & open/close:** `BookCover` (DOM/SVG art, hover tilt), open/close transition + SFX, close-button + Esc.
- [x] **Phase 4 — Spread mode:** `BookSpread` + `PageLeaf` flip (forward/backward), gutter, page-edge stacks, margin tap zones + corner buttons, arrow-key spreads, reduced-motion fallback.
- [x] **Phase 5 — Single mode:** `BookSinglePage` slides + boundary flips, 768px breakpoint switching, one-step keyboard nav, mobile controls.
- [x] **Phase 6 — Chrome & persistence:** rewire header/footer/TOC, close button, SFX pass (slide cue?), persistence end-to-end, delete three.js + 3D modules, update `+page.svelte`.
- [ ] **Phase 7 — Polish:** optional open-cover sliver, shadow tuning, a11y pass (focus order, labels), copy pass ("next spread" vs. "next page"), mobile perf check on low-end devices.

---

## 15. Open Questions / Deferred

- **Slide SFX:** soft cue or silence for within-spread slides (decide in Phase 5/6).
- **Large TOC jumps:** single flip vs. fast crossfade for far jumps (first cut: one flip; revisit).
- **Open-cover sliver** at the spread's left edge (Phase 7 polish).
- **Spine drag (finger-follows-leaf):** not in scope — taps only. Could be a future extension of `PageLeaf`.
- **Odd page counts:** invariant "even pages or append blank verso" — document in the data model when adding content.
