# Dynamic Flashcards — frontend demo

An Electron desktop interface for concept-based flashcards, with Spanish UI, Markdown and LaTeX notes, and persistent **light and dark themes**. The backend has been removed so it can be added later. No database, API key, AI calls, FSRS scheduler, or background generation jobs are included.

## Run locally

Requires Node.js 24+ and npm. Linux also needs the normal Electron desktop libraries and a working display/Chromium sandbox.

```bash
npm ci
npm run dev
```

Use the sun/moon button in the top bar or **Ajustes → Apariencia** to switch themes. The first launch uses your operating system's appearance; subsequent launches restore your choice.

Create a concept or choose **Cargar datos de ejemplo**, then open **Estudiar**. Reveal your original note and self-rate with **1–4**. **Space/Enter** reveals or advances; **Esc** exits the session. Practice totals appear in Estadísticas. The demo never generates or verifies variants and never schedules a due date.

## Commands

| Command                 | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`           | Start Electron with development reload                                                       |
| `npm test`              | Test frontend persistence, input validation, theme preference and desktop payload validation |
| `npm run typecheck`     | Check strict TypeScript                                                                      |
| `npm run build`         | Build main, preload and renderer                                                             |
| `npm run dist`          | Package the current platform into `dist/`                                                    |
| `npm run test:electron` | Run the isolated Playwright desktop smoke test after building                                |
| `npm run format:check`  | Check formatting                                                                             |

Packaging config covers Linux AppImage/deb, macOS dmg and Windows NSIS. No signing is configured. Run packaging on the target platform. There is no SQLite native dependency and no native module rebuild step. The postinstall script explicitly downloads the Electron desktop binary so development and smoke tests work immediately after `npm ci`.

## Architecture

- `src/main/app`: secure window lifecycle, single-instance lock and window bounds.
- `src/main/ipc`: two validated desktop capabilities: opening HTTPS links and saving an exported JSON file through a native dialog.
- `src/preload`: exposes only `window.desktop`; never exposes raw IPC or Node APIs.
- `src/renderer/src/demo.ts`: small, typed frontend store for concepts and demo self-ratings. All operations are local and synchronous; no backend simulation or business services run in Electron's main process.
- `src/renderer/src/store.ts`: React subscriptions to the demo store.
- `src/renderer/src/theme.tsx`: appearance context, system preference fallback and saved theme choice.
- `src/renderer/src/style.css`: shared theme tokens for every page.

Demo notes and self-ratings use localStorage under `dynamic-flashcards.frontend-demo.v1`; appearance uses `dynamic-flashcards.theme`. **Ajustes → Exportar datos** saves the demo notes and activity as JSON. If storage fails, a visible notice explains that changes must be exported before closing. The old backend's database and key files are neither read nor removed from an existing user profile. They are not migrated into this demo.

## Security

The renderer has `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. Popups, redirects and navigation away from the application are blocked. IPC validates payloads and checks the sender window/main frame. External links accept only HTTPS. Local CSP forbids remote scripts; Markdown strips raw HTML and is sanitized before KaTeX rendering. Remote images are not fetched. No secrets or networking credentials are needed.

## Cloud environment

The cloud setup uses writable caches:

```bash
export XDG_CACHE_HOME=/tmp/dynamic-flashcards-cache
export ELECTRON_GET_USE_PROXY=true
export electron_config_cache=/tmp/dynamic-flashcards-electron
npm ci
npm test
npm run build
```

This managed host currently blocks Chromium's OS sandbox startup (user namespaces are unavailable and there is no usable root-owned sandbox helper). Normal `npm run dev` requires a desktop host with that support; the application does not disable the sandbox by default. Playwright's Electron test driver uses a test-only `--no-sandbox` launch and a temporary profile. This verifies the BrowserWindow security settings and UI but does not prove OS sandbox enforcement.

For headless UI checks, start an available Xvfb display, then run `DISPLAY=:99 npm run test:electron`. This environment retains `/workspace/.dynamic-flashcards-tools/usr/bin/Xvfb`. Stop only the display you started. The smoke test checks both themes, persistence after reload, absence of backend APIs/files, note creation, KaTeX, keyboard self-rating and practice totals.

## Assumptions

- The latest request replaces the backend scope: this version focuses on the desktop frontend and appearance. The earlier backend implementation remains recoverable from Git history.
- Local browser storage is appropriate for a reversible demo. It is not a production database, encrypted storage or a synchronization mechanism.
- Study effort and available minutes select a demo session's size; every item uses the original note and self-rating. Mode preference is saved for the future backend.
- No API keys, models, environment variables or server are required to use the demo.

## Known limitations / next steps

- Connect your future backend at the renderer data boundary; add generation, verification, grading, scheduling, graph relationships and their tests then.
- No automatic evaluation, due dates, suggested connections or generated variant pool is presented as working functionality.
- No import or migration UI yet; keep exported JSON backups of demo notes.
- macOS and Windows packaging need validation on their respective hosts.
- Auth, sync, Anki imports, media imports, graph visualization, mobile, voice, code execution, updates, signing, tray and OS jobs remain outside this version.
