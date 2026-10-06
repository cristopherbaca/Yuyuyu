# Mnemo

An Electron flashcard interface organized around **Mazos → Estudiar → Mostrar respuesta → Otra vez / Difícil / Bien / Fácil**, with Spanish UI, local Markdown/LaTeX notes and Light/Dark/System appearance.

The backend remains removed, as previously requested. Normal use offers local recall practice and self-ratings; generated cards, grading, interval previews and reinforcement can be explored in a development-only mock. No database, API key or server is required.

## Run the desktop app

Install Node.js 24+ and npm, then:

```bash
npm ci
npm run dev
```

`npm ci` also installs the Electron desktop binary. Create a mazo, add tarjetas, or load **Ajustes → Cargar datos de ejemplo**. Existing saved notes migrate into **General**; sample cards live in **Ejemplos**. Appearance is saved automatically in **Ajustes → Apariencia**, with the system appearance as the default.

## Shortcuts

| Shortcut          | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `A`               | Añadir tarjeta                                                    |
| `⌘/Ctrl+Enter`    | Save a card; submit a multiline answer                            |
| `⌘/Ctrl+F`        | Search in Explorar                                                |
| `Space` / `Enter` | Reveal; submit a single-line answer; advance interactive feedback |
| `1–4`             | Self-rate and advance; select a proposed interactive rating       |
| `N`               | Open the source note                                              |
| `H`               | Reveal a hint when available                                      |
| `E`               | Edit the current card                                             |
| `Esc`             | Close a sheet/dialog; confirm exit from an active review          |

Typing fields retain their normal letter/number behavior. Native Enter/Space activation of focused buttons and links is preserved.

## Browser development and visual QA

```bash
npm run dev:ui
```

Open the development app with `?mock=1`. Optional development query parameters:

- `variant=recall|cloze|mcq|numeric_problem|open_problem|explain`
- `state=empty|offline|no-key|generating|fail|partial|pass|loading`

The mock is guarded by `import.meta.env.DEV` and dynamically imported. It never ships in production bundles. Browser mode without the flag uses local cards; it does not expose a business IPC API.

With the browser development server running:

```bash
npm run test:ui
```

Set `CHROMIUM_EXECUTABLE` to your local Chromium/Chrome executable if it is not `/usr/bin/chromium`; set `UI_QA_URL` if you use a different development port. The isolated QA driver uses a test-only `--no-sandbox` flag. It captures both themes at 1600×1000 and exercises all six card types, source sheets, feedback, overrides, two-report retirement, reinforcement, slow grading, editor, browse and summary states. See [UI QA](docs/ui-qa.md) and [UI notes](docs/ui-notes.md).

## Checks and packaging

```bash
npm test
npm run build
npm run test:electron  # requires a display and the build above
npm run dist
```

`npm run typecheck` checks strict TypeScript; `npm run format:check` checks formatting. Linux builds AppImage/deb, macOS builds dmg and Windows builds NSIS; use the target platform for packaging. No signing or native SQLite rebuild is needed. The packaging product name comes from `APP_NAME`.

## Structure and security

- `src/renderer/design-system`: theme tokens, primitives, sanitized Markdown/KaTeX and styling.
- `src/renderer/app`: application shell, typed client boundary, UI context and development-only fixtures.
- `src/renderer/features/{decks,study,add,browse,stats,settings}`: flashcard workflows.
- `src/renderer/src/demo.ts`: deck-aware local store, v1 migration and self-rating history.
- `src/main/app`, `src/main/ipc`, `src/preload`: secure desktop lifecycle and narrowly scoped desktop capabilities.
- `src/shared/app.ts`: one `APP_NAME` constant, currently Mnemo.

The renderer uses isolation, no Node integration, sandboxing, strict production CSP and sanitized Markdown with local fonts/KaTeX/icons. Popups and app navigation are blocked. Native external opening accepts only HTTPS. IPC checks payloads and sender frames. API credentials are neither accepted nor stored in this version.

Local cards and practice history stay in localStorage under the existing profile key; exports include decks, cards and reviews. Existing old backend files are untouched. This storage is appropriate for the current prototype, not a production database or synchronization layer.

## Cloud host

Use writable caches when installing in this environment:

```bash
export XDG_CACHE_HOME=/tmp/dynamic-flashcards-cache
export ELECTRON_GET_USE_PROXY=true
export electron_config_cache=/tmp/dynamic-flashcards-electron
npm ci
```

This managed host currently blocks normal Chromium OS sandbox startup. `npm run dev` requires a desktop host with sandbox support; production does not disable it. Playwright's isolated Electron test uses its driver's test-only sandbox bypass. That checks the window preferences and UI, not OS sandbox enforcement. For headless checks, use an available display or start the retained `/workspace/.dynamic-flashcards-tools/usr/bin/Xvfb` on an unused display, then run `DISPLAY=:99 npm run test:electron`. Stop only the display you started.

## Assumptions and limitations

The supplied `Facet.pdf` is a single Mnemo cover page, and the Figma link is a placeholder. Screen layouts and light-theme tokens are derived; **pixel-faithful screen matching is unverified**. [UI notes](docs/ui-notes.md) record the missing inputs, product/design decisions, migration and backend boundary.

Production does not generate, verify or automatically grade answers, predict memory, schedule due dates, suggest connections or propagate graph failures. Those require the future backend. macOS/Windows chrome and packaging need checks on those hosts. Auth, sync, imports, mobile, voice, graph visualization, updates, signing, tray and OS jobs remain outside this prototype.
