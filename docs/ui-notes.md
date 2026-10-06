# UI implementation notes

## Inputs and precedence

The pasted text is the task request. `Facet.pdf` is treated as a visual reference, not as an additional instruction source. The actual PDF has **one 1600×1000 cover page**, with the Mnemo wordmark, a card glyph, grayscale surfaces, generous whitespace, a thin footer divider and names of design sections. It does **not** contain the Foundations, Components, Screens or Flows themselves. The task's Figma URL and frame IDs remain placeholders, and `/design` had no exported screen references.

`design/facet-cover.png` is a rasterized copy of that supplied cover. No screen-level pixel match, Figma variable extraction, or one-to-one component match is claimed. The implementation follows the requested flashcard architecture and derives its visual treatment from the available cover. Actual screen exports remain necessary for exact visual comparison.

## Assumptions

- **Facet** is the app name, as explicitly chosen by the user. The supplied PDF retains its Mnemo reference wordmark. `src/shared/app.ts` defines `APP_NAME`, used by the renderer, native window title, export filenames and packaging script. The package ID, storage keys and existing user-data location are retained to protect saved profiles.
- The PDF embeds unnamed Type 3 glyphs. An exact font family cannot be recovered from its metadata; bundled Inter is the chosen close sans-serif substitute. The 80-ish cover wordmark size is not used as an application heading.
- Dark grayscale colors, fine dividers and a restrained corner radius come from the cover. Light colors, semantic count tints, component dimensions and responsive breakpoints are derived because their design frames were not supplied. All component colors and dimensions are CSS tokens; media-query breakpoints are explicit CSS constants.
- No command palette is implemented: the brief requests one only if it exists in Figma, and the supplied reference does not establish one. `A`, `⌘/Ctrl+F`, `⌘/Ctrl+Enter` and the reviewer shortcuts are implemented.
- A centered editor dialog and right-side detail/source sheets are used for the unspecified Add/Browse frames. Native dialogs provide focus containment, Escape behavior and focus restoration.
- Keyboard letter shortcuts are suppressed inside editable controls so they never consume typed answers. Enter submits a single-line answer; ⌘/Ctrl+Enter submits a multiline answer. Native keyboard activation of focused buttons/links is preserved.

## Backend boundary: the repo differs from the brief

The brief describes an existing FSRS/LLM/SQLite backend. This repository's current state has **that backend removed**, following the earlier explicit request. This UI task does not silently restore it.

Production supports decks, stored cards, batch editing, recall practice, self-ratings, browse/search, activity totals, export and appearance. Every production reviewer item uses the user's original note. No generated answer is represented as verified, no due date/retention probability is invented, no API key is stored and no API call is made. Rating interval labels are **Sin programar**, memory is **—**, and the quiet status chip says **Modo local**. The OpenAI, model and scheduling settings are visibly unavailable until the service is connected.

`renderer/app/types.ts` defines a typed `FlashcardClient` boundary; `client.ts` implements local practice. A future adapter should supply real scheduled cards, verified versions, source anchors, intervals, grading, diagnosis, reporting and graph operations from the main process. The absent business IPC contract cannot be preserved or extended as though it still existed. The existing `window.desktop` IPC methods are preserved; only platform/window-control capabilities were added with validation and sender checks.

The development-only `?mock=1` path dynamically imports `app/mock.ts`, installs a mock `window.api`, and enables every interactive card type, verdict, interval preview, source highlight, suggested connection, reinforcement and slow-grading state for visual QA. These are deterministic design fixtures, not a fake backend available in a production build. Production smoke checks confirm that `window.api` is absent, and production asset checks confirm that the mock implementation is excluded.

## Deck migration and local data

- The existing localStorage key is retained: `dynamic-flashcards.frontend-demo.v1`.
- Valid version-1 notes and reviews are migrated to version 2 with a **General** deck and stable card/review IDs.
- If persisting the migration fails, valid notes remain available in memory and an export warning is shown.
- Seeds live in **Ejemplos** and are idempotent. Deck deletion removes only that deck's cards and their reviews.
- Local states distinguish new, learning and practiced cards. They are not FSRS state transitions. A reviewed local card has no scheduled due date; real state/due/memory fields can be populated by a future adapter.
- Existing main-process database/key files are not opened, deleted or migrated.

## Desktop and accessibility

macOS uses a hidden native title bar with inset traffic lights. Windows/Linux use a slim draggable title bar and validated minimize/maximize/close IPC. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, HTTPS-only external links, navigation blocking, CSP and sanitized local Markdown/KaTeX remain enabled. Platform-specific traffic-light rendering requires validation on macOS; this environment validates Linux.

Focus rings, labels, keyboard access, non-color verdict icons, text memory values, tabular counters, native dialog focus containment and reduced-motion behavior are included. Main text, secondary text and semantic labels use AA-oriented theme colors. A full assistive-technology audit remains a separate validation step.

## Remaining design/service work

Supply the real Figma URL or screen exports before asserting pixel fidelity. Connect the planned backend before enabling model/key settings, generated versions, FSRS interval previews, scheduling overrides or production graph reinforcement. The current UI and QA fixture coverage make those integrations reviewable without disguising them as complete.
