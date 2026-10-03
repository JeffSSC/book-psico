# Plan: Plateia Imaginária (Interactive Psychology Web Book)

## 1. Project Overview & Concept

**Plateia Imaginária** (*Imaginary Audience*) is an interactive digital psychology book exploring the psychological phenomenon first conceptualized by David Elkind — where an individual feels intensely scrutinized and observed by everyone around them (closely tied to adolescent egocentrism, personal fables, social anxiety, and digital-age self-perception).

Unlike conventional digital texts, this project marries a tactile, book-like reading experience with interactive psychological experiments, dilemmas, and perspective-taking exercises.

---

## 2. Core Experience & Reading UX

- **Single-Page Flip Interaction:**
  - Mimics leafing through physical paper with realistic 2D/3D flip transitions across all viewports (desktop, tablet, mobile).
  - Navigation support: Drag/touch swipe gestures, arrow keys, and on-screen corner/leaf cues.
  - Quick-navigation drawer / Table of Contents allowing readers to jump between chapters and bookmarked pages.
- **Audio & Sensory Feedback:**
  - Subtle acoustic feedback for page turns (crisp paper sound fx).
  - Ambient interaction cues for psychological dilemmas and quiz responses.
  - Persistent global audio toggle (Mute / Unmute) saved across sessions.
- **Reading State & Persistence:**
  - Automated client-side persistence via `localStorage`:
    - Last-read page position (automatic bookmarking).
    - Dilemma choices, quiz answers, and user self-reflection logs.
    - Sound preferences and reading progress metrics.

---

## 3. Data-Driven Architecture

The book content is authored in structured data modules (JSON/TypeScript data structures or Markdown definitions) to separate content creation from reader rendering logic:

```typescript
export interface BookPage {
  id: string;
  pageNumber: number;
  chapterTitle?: string;
  type: 'standard' | 'interactive' | 'cover' | 'index';
  title?: string;
  content: {
    paragraphs?: string[];
    media?: {
      type: 'image' | 'video' | 'illustration' | 'svg';
      src: string;
      alt?: string;
      caption?: string;
    };
    canvasActivity?: {
      type: 'dilemma' | 'perspective-test' | 'quiz' | 'audience-simulation';
      config: Record<string, unknown>;
    };
  };
}
```

---

## 4. Component Hierarchy & Design System

```text
src/
├── lib/
│   ├── components/
│   │   ├── book/
│   │   │   ├── BookReader.svelte      # Master flip engine & gesture controller
│   │   │   ├── PageLayout.svelte      # Single-page container framing content
│   │   │   ├── PageHeader.svelte      # Chapter indicators & pagination numbers
│   │   │   ├── PageTitle.svelte       # Typography-styled page headings
│   │   │   ├── PageText.svelte        # Prose, quotes, callouts, and reflections
│   │   │   ├── PageMedia.svelte       # Visual illustrations, figures, diagrams
│   │   │   └── PageCanva.svelte       # Host component for interactive experiments
│   │   ├── activities/
│   │   │   ├── PerspectiveDilemma.svelte # Choice-based perspective-taking
│   │   │   ├── SocialSpotlightQuiz.svelte # Bias assessments & interactive questions
│   │   │   └── AudienceSimulator.svelte   # Interactive canvas simulation
│   │   └── ui/
│   │       ├── AudioControl.svelte    # Mute/unmute sfx toggle
│   │       ├── TableOfContents.svelte # Drawer / modal menu
│   │       └── ProgressBar.svelte     # Bottom reading progress indicator
│   ├── data/
│   │   └── pages/                     # Structured chapter content definitions
│   └── stores/
│       ├── bookStore.svelte.ts        # Reading position, bookmarks, sound state (Svelte 5 runes)
│       └── sfx.ts                     # Web Audio API / lightweight paper sound effects
```

---

## 5. Interactive Mechanics & Psychology Experiments

1. **Perspective-Taking Dilemmas:**
   - Scenarios placing the reader in socially charged situations (e.g. entering a crowded room, social media reactions, public speaking).
   - Readers select actions/assumptions and receive real-time psychological deconstructions contrasting the *perceived* audience reaction against *actual* observer behavior.
2. **The "Spotlight Effect" Experiment:**
   - Interactive estimation tasks (e.g., "How many people in this virtual room noticed your mistake?").
   - Instant reveal of empirical psychological research data on how observers actually perceived the event.
3. **Reflective Assessments & Quizzes:**
   - Gamified mini-quizzes testing comprehension of developmental psychology concepts with immediate contextual feedback.

---

## 6. Tech Stack & Dependencies

- **Framework:** SvelteKit 3.0 (with Svelte 5 runes for reactive state)
- **Language:** TypeScript
- **Styling:** TailwindCSS 4.x
- **Audio:** Web Audio API / Lightweight HTMLAudio sfx player
- **Testing:** Vitest & Playwright

---

## 7. Phased Implementation Roadmap

- [ ] **Phase 1: Reader Engine & Page-Flip**
  - Implement single-page physical flip mechanics (CSS 3D transforms + touch/keyboard handlers).
  - Setup basic book navigation controls, progress indicator, and sound effects toggle.
- [ ] **Phase 2: Content Model & Layout Components**
  - Create `PageLayout`, `PageTitle`, `PageText`, `PageMedia`, and `PageCanva`.
  - Build sample chapter data for "Plateia Imaginária".
- [ ] **Phase 3: Interactive Dilemmas & Canvas Experiments**
  - Develop interactive perspective-taking scenarios within `PageCanva`.
  - Implement quiz assessment components with instant feedback.
- [ ] **Phase 4: Persistence & Polishing**
  - Connect `localStorage` for progress and answer retention.
  - Refine typography, page shadow/lighting realistic shaders, sound transitions, and mobile responsiveness.
