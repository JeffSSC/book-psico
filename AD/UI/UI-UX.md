# UI / UX Specification: Plateia Imaginária

## 1. Core Visual Philosophy: Distraction-Free Reading

The reading experience is designed to feel like holding a clean, single sheet of literary paper:
- **Outer Viewport Background:** Pure white (`#FFFFFF`), creating a calm, high-contrast, distraction-free framing.
- **Page Sheet Background:** Warm paper tone `#FDFBF7`, simulating an authentic tactile sheet of paper.
- **Flat Aesthetic:** Completely flat design — **zero drop shadows**, no heavy borders, and no skeuomorphic book spine or gradient crease overlays.
- **Cleanliness:** No persistent top header bar, no bottom footer toolbar, and no Table of Contents menu. Only the pure page content is displayed.

---

## 2. Layout, Sizing & Responsiveness

- **Height:** Exactly `100vh` (covering the full viewport height) on all devices.
- **Width:**
  - **Mobile & Tablet:** 100% full-bleed width with comfortable internal margin padding.
  - **Desktop & Larger Screens:** Centered horizontally on the white screen, constrained to a maximum width (`max-w-2xl` / ~672px to `max-w-3xl` / ~768px) for optimal typographic line-length and reading comfort.
- **Internal Padding:** Generous top, bottom, and side padding ensuring text and interactive elements never collide with the screen edges or navigation buttons.

---

## 3. Page Structure & Elements

Inside the `#FDFBF7` page component:
- **Top Right Corner:** A discreet page indicator (e.g., `03` or `3 / 7`) in a subtle, muted font.
- **Page Body:** Pure content flow (Title, Subtitle, Prose paragraphs, Callout insights, or Interactive `PageCanva` activities).
- **Navigation Controls:**
  - **Bottom Left:** Button to turn backward (`Anterior`), styled cleanly with icon and label, disabled on page 1.
  - **Bottom Right:** Button to turn forward (`Próxima`), styled cleanly with icon and label, disabled on the last page.
  - Positioned non-intrusively in the bottom corners of the page sheet so they remain accessible without interrupting reading flow.

---

## 4. Navigation & Page-Turn Mechanics

- **Flat 3D Page Turn:**
  - Smooth, tactile 3D rotation (`rotateY`) around the vertical axis.
  - Clean execution without artificial drop shadows cast on the page beneath, specular sheen overlays, or faux spine binding.
- **Input Methods:**
  - Corner navigation buttons (bottom left & right).
  - Keyboard arrow keys (`←` and `→`, `Space`).
  - Pointer & touch swipe gestures (horizontal swipe left/right).
- **Audio:**
  - Subtle, zero-latency paper rustle sound effect on turn (Web Audio API), complementing the tactile leafing.

---

## 5. Typography & Component Hierarchy

- **Typefaces:**
  - Headings & Prose: Serif typography (`Lora` / Georgia) for academic and literary elegance.
  - Page numbers & UI labels: Minimalist sans-serif / monospace (`Plus Jakarta Sans`) in muted stone tones.
- **Interactive Elements:**
  - Psychology dilemmas, spotlight effect experiments, and quiz questions blend naturally into the `#FDFBF7` page surface without bulky card frames.
