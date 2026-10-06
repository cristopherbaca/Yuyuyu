# Dynamic Flashcards · v0.1

An Electron desktop application for learning **concepts**, with a fresh, verified question at each review. Spanish UI, Markdown and LaTeX, local SQLite storage, and deterministic FSRS scheduling. OpenAI decides what to ask; it never decides when to review.

## Setup

Use **Node.js 24 LTS or newer**, npm, and a desktop session on macOS, Windows, or Linux.

```sh
npm ci
npm run dev
```

`npm ci` runs the native SQLite compatibility check. The lockfile pins the tested dependencies. npm and packaging caches are kept in the ignored `.onboarding/` directory when no explicit cache location is configured.

To try the complete workflow without an API key or network:

```sh
# macOS/Linux
FAKE_LLM=true npm run dev
```

On Windows PowerShell: `$env:FAKE_LLM='true'; npm run dev`. Alternatively enable **Modo de simulación (FAKE_LLM)** in **Ajustes**. Choose **Cargar datos de ejemplo** for three Spanish notes and a confirmed prerequisite edge.

For real generation, enter your key in **Ajustes**, enter a cheaper generation model and a stronger verification model available to your OpenAI account, disable simulation, save preferences, and click **Rellenar banco ahora**. Both models must support Structured Outputs through the Responses API. There are no hardcoded model names. Real API calls require HTTPS access to `api.openai.com`.

### Commands

| Command                 | Purpose                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`           | Electron application with Vite hot reload                                               |
| `npm test`              | Vitest logic/integration tests; in-memory SQLite, fake provider, no Electron or network |
| `npm run typecheck`     | Strict TypeScript check, including automation and tests                                 |
| `npm run build`         | Type check and production main/preload/renderer bundles in `out/`                       |
| `npm run dist`          | Build and package the current platform into `dist/`                                     |
| `npm run rebuild`       | Verify SQLite under Electron; rebuild if the binding is incompatible                    |
| `npm run test:electron` | Playwright Electron smoke test against an existing production build                     |
| `npm run format`        | Format application, tests, and configuration                                            |
| `npm run format:check`  | Check formatting                                                                        |

The Electron smoke test uses a temporary user-data directory and removes it afterward. Run `npm run build` before it. On Linux it needs a display; `xvfb-run -a npm run test:electron` works when Xvfb is installed. For a clean install on the managed cloud, set `XDG_CACHE_HOME=/tmp/dynamic-flashcards-cache`, `ELECTRON_GET_USE_PROXY=true`, and `electron_config_cache=/tmp/dynamic-flashcards-electron` before `npm ci`; this keeps Node headers and Electron artifacts in writable, verified caches. The cloud instance has a locally extracted Xvfb at `/workspace/.dynamic-flashcards-tools/usr/bin/Xvfb`.

### Native SQLite and packaging

The installed `better-sqlite3` **13.0.3** ships Node-API prebuilds. `scripts/native.ts` actually loads SQLite using the installed Electron **44.5.1** runtime and executes a query. A valid prebuild works in both Node/Vitest and Electron without switching ABI bindings. The `beforeBuild` hook skips unnecessary compilation only after this check; it retains the standard builder rebuild for unsupported/mismatched targets. `npm run rebuild` falls back to `electron-builder install-app-deps` when the runtime check fails. Source rebuilds need a compiler toolchain and access to Electron's official headers; keep signature, checksum, and TLS checks enabled.

`electron-builder.yml` configures macOS DMG, Windows NSIS, and Linux AppImage/deb. Build on the corresponding host OS. No signing, notarization, publishing, or auto-update is enabled. `dist/linux-unpacked/` is also directly runnable on a suitable Linux desktop. The native package is unpacked from ASAR.

### Development environment variables

Copy `.env.example` to `.env` if needed; `.env` is ignored. It is read **only in development**:

- `OPENAI_API_KEY`: optional development key, retained in the main process.
- `OPENAI_MODEL_GENERATE`: your cheaper Structured Outputs model.
- `OPENAI_MODEL_VERIFY`: your stronger Structured Outputs model.
- `FAKE_LLM=true`: deterministic simulation without any remote calls.

Model values in the example are clearly marked placeholders. A saved `settings.json` takes precedence over development defaults. Saving/deleting an API key in Settings replaces the development key binding for that running app; the environment default can return on a later dev launch. Remove it from `.env` to permanently remove that default.

`DYNAMIC_FLASHCARDS_USER_DATA` optionally selects a separate local profile, useful for tests. No key or model is needed for fallback reviews. Do not put keys into source files, logs, issue reports, or cloud setup scripts.

### Linux sandbox and this cloud host

The application always configures `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. A normal desktop must provide Chromium's supported OS sandbox (user namespaces or a correctly installed system sandbox helper). On a managed Linux host that prohibits namespaces and does not provide a root-owned setuid helper, a normal `npm run dev` launch is blocked by Chromium before the UI starts. Configure that host's sandbox support; the app does not automatically disable sandboxing.

This cloud machine has that restriction. Playwright launches Electron with its test-only `--no-sandbox` argument, and the development renderer was also exercised with an explicit test-only `--noSandbox` flag and a temporary profile under Xvfb. These validate application behavior and the BrowserWindow isolation settings; they **do not establish OS sandbox enforcement on this host**. The ordinary application and saved startup instructions retain sandboxing.

## How to use

1. Create a concept with a title and a Markdown note. Include all facts/formulas/examples the generator may use. Pick **Simple**, **Problemas**, or **Ambas**.
2. Wait for the live verified-pool count or use the static fallback immediately. The note remains available offline.
3. Choose **Estudiar**, effort, and minutes. **Rápido** includes recall/cloze/MCQ; **Normal** also includes numeric problems; **Profundo** adds open application and explanation questions.
4. Answer or reveal and self-rate. A hinted answer cannot become Easy. After grading, compare the answer and worked solution with your original note.
5. Use **No estoy de acuerdo** to change the verdict. FSRS recomputes from the stored pre-review card, and updates the concept only if this is its latest review. The original grader verdict is preserved beside your override. **Reportar error** retires a variant on its second report.
6. Confirm suggested prerequisite edges in concept details. Only confirmed prerequisites can be inserted as reinforcement after a failure.

Keyboard shortcuts: **Space/Enter** reveal or submit (Enter inside a textarea keeps a newline), **1–4** self-rate, **H** hint when focus is outside an answer field, **Esc** leave the session. The session progress includes inserted prerequisite items.

Settings also provides seed data, manual pool refill, and a native JSON export dialog. Export includes concepts, graph edges, variants and verification reports, and review history; it never includes the API key. Back up your user-data directory for a complete local backup.

## Architecture

```text
src/shared/          Zod data schemas, IPC payloads and typed results
src/main/app/        Electron lifecycle, secure window, window geometry
src/main/db/         Drizzle schema, transactional versioned SQL migrations
src/main/secrets/    Electron safeStorage, write-only key interface
src/main/llm/        Injected provider interface, OpenAI/fake implementations, prompts
src/main/services/   Pure TypeScript business logic; no Electron imports
src/main/ipc/        Sender checks, Zod validation, native export dialog
src/preload/         Bundled sandbox-compatible contextBridge API
src/renderer/        React, HashRouter, Tailwind, sanitized Markdown and KaTeX
scripts/             Typed runtime/build checks; tiny CJS electron-builder hook shim
```

Services receive database, provider, clock, settings and event callbacks by injection. `src/main/index.ts` calls the Electron bootstrap in `app/`. SQLite lives at `app.getPath('userData')/flashcards.db`, with WAL, foreign keys, a busy timeout, indexes, and migrations run at startup. Times are persisted as UTC epoch milliseconds; JSON FSRS dates are restored and validated on read. Non-secret preferences and window bounds are separate JSON files in userData.

Installed APIs were inspected before integration: `ts-fsrs` **5.4.2** uses `createEmptyCard`, `fsrs().next`, `Rating`, `State`, and numeric `get_retrievability(..., false)`; OpenAI SDK **7.28.0** uses `responses.parse` with `zodTextFormat`. FSRS fuzz is disabled for deterministic scheduling. The official SDK transport uses paired Undici fetch/dispatcher options when HTTP(S) proxy variables are present and honors NO_PROXY, without disabling TLS verification. The SDK has request timeouts and bounded retries for transient failures. Actual call attempts, including refusals/errors and fake calls, are logged to `llm_calls`; no credentials are logged.

### Generation and verification

The pipeline requests a typed output, checks shape and grounding (partial-ratio threshold 90), and solves the question independently with the stronger model. **The blind solver receives no generated answer, hints, rubric, or solution steps.** Closed answers are compared in code; open/recall answers receive a stronger-model consistency judgment. Numeric problems also pass the independent `DeterministicVerifier` math hook. Only successful variants receive `verified`; failures receive `rejected` and a report. There are up to three attempts per slot. Unsupported types are skipped.

Grounding and model verification reduce hallucinations but cannot prove educational correctness. The note is the factual authority; an incorrect source note can still produce an incorrect question. Reporting and the original-note comparison remain useful.

Pool refill runs on startup, every 30 minutes while open, after creation/edit/review/failure, and manually. Per-concept work is serialized, concept jobs and provider calls have concurrency limits, and pool type counts keep a spread across the allowed types. Results from an edited/deleted concept or stale FSRS/error context are discarded. No API key or an offline failure preserves the existing pool. Provider failures open a 30-second cooldown to avoid a batch of repeated failed requests; saving connection settings resets it. Failure refills take priority over queued batch work.

Session construction queries only verified variants, excludes retired/reported items, respects mode/effort and estimated duration, prefers unused questions and different types, and sorts due concepts by lowest FSRS retrievability. When no usable variant fits, it serves a static recall card built from the note without waiting for generation. Open grading outages offer an explicit reveal-and-self-rate fallback.

On failure, an immediate local diagnosis and weak confirmed prerequisite keep review feedback responsive. The cheaper model refines the diagnosis asynchronously; the refill receives the latest error/angle. A late diagnosis cannot overwrite an edited note or an override to pass. Reinforcement is returned inline, never by altering FSRS due dates outside a review.

### Security and privacy

- API keys use Electron `safeStorage`. Linux `basic_text` is treated as unavailable encryption. When encryption is unavailable, the UI clearly warns and a private-permission plaintext fallback is used. No renderer getter returns the key.
- The preload exposes only the typed API, never raw `ipcRenderer`. Invocation handlers check the main window and main frame and validate every payload. Results are `{ ok: true, data }` or a typed safe error.
- New windows, external navigation and redirects are blocked. Markdown links invoke a validated main-process `https:` opener. Raw HTML and remote Markdown images are excluded; sanitization precedes KaTeX, with trusted LaTeX commands disabled.
- Production CSP permits local bundled scripts only. Development uses a per-run nonce for Vite's inline bootstrap and loopback WebSockets; no remote scripts are allowed. Fonts and assets are bundled locally.
- OpenAI receives the note/question/answer information needed for the requested task. Requests set `store: false`. Notes and answers are untrusted prompt data. No LLM-written code executes; numeric evaluation is restricted to bounded arithmetic and vetted functions.
- The application has a single-instance lock. Session delivery is revalidated on reveal/submit; changed notes, retired variants and repeat submissions are rejected.

## Validation

Seven Vitest suites cover 31 tests: migrations/settings, FSRS mapping and overrides, normalization/MCQ/numeric equivalence, grounding, verified/rejected/unsupported generation, difficulty thresholds, mode/effort/type selection, budget/new limits, static fallback, failure/confirmed-edge reinforcement, report retirement, IPC validation, fake numeric/open reviews, outage self-rating, stale sessions, older overrides, call logging, seed/export/stats integration, and mocked SDK proxy/Structured Outputs/refusal handling.

The Electron smoke test exercises an actual window and SQLite file, checks isolation preferences and absence of renderer `require`, verifies write-only secret storage and KaTeX, creates a concept and waits for five verified variants, self-rates with keyboard shortcuts, checks the due date changes, overrides, reports twice, and reads LLM statistics. It uses fake calls and makes no OpenAI requests.

Production build, native compatibility, and Linux AppImage/deb packaging were exercised in the cloud. macOS/Windows artifacts and real OpenAI responses remain untested here; no key was provided. Network-free fake generation and review flows were verified. See the Linux sandbox limitation above for the distinction between test launches and a normal launch on this host.

## Assumptions

- A single local user and profile; no authentication, server, synchronization or cloud application database.
- Notes are authoritative and language is inferred by the provider. The fake implements Spanish/English fixtures; live prompts require the note's language.
- The effort table governs allowed types: an open problem needs **Profundo**, even though the brief's completion example mentions Normal alongside open problems.
- A never-reviewed concept has retrievability 0. Daily new-concept allowance counts unique introductions on the local calendar day; due learning/review concepts are not charged again.
- Building a session reserves variants by incrementing `times_shown`. Abandoning a session does not undo that count. Existing verified variants may be reused when unused variants are unavailable.
- Cloze accepted alternatives are stored separately; MCQ answers are zero-based choice indices. Numeric input is a dimensionless number or expression, with relative/absolute tolerance `1e-6`; units belong in the question.
- Source note edits preserve FSRS progress and review history, retire prior active variants, and require a new session for previously delivered items.
- A failure's prerequisite intervention can extend the initial minutes estimate. There is one weakest confirmed prerequisite per failure; no recursive cascade is scheduled.
- Long-running error diagnosis is asynchronous. A local provisional error summary is immediately saved so provider downtime cannot block closed/static review feedback.
- Changing retention applies to subsequent reviews/overrides. Older-review overrides update the historical row without replaying all later reviews.
- Cost is a token-based illustrative estimate, not a bill: generation input/output $0.50/$2 and verification $5/$15 per million tokens. Unknown usage on failed calls is 0; fake usage and cost are 0.
- Build tooling requires Node 24 to execute typed automation directly; the one-line CJS hook is required for electron-builder interoperability.
- This is a prototype: fake templates test plumbing and math consistency; they do not simulate the variety or semantic judgment quality of a real model.

## Known limitations / next steps

- Real OpenAI quality, supported models, latency and account access need validation with your key. Very long notes or unsupported Structured Outputs models can fail gracefully; generation has no within-a-minute latency guarantee.
- Linux managed hosts need OS sandbox support for a normal app launch. This cloud's virtual-display tests do not validate OS sandbox enforcement. macOS/Windows packaging needs validation on those hosts.
- Fake generation is intentionally simple and may distinguish repeated questions with an angle label. Production novelty depends on the prompt and exact-question duplicate rejection; semantic duplicate detection is a future improvement.
- Suggested graph edges refresh when opening/reloading details; pool counts update live. There is no graph visualization, edge cycle analysis or semantic prerequisite ranking beyond FSRS weakness.
- OpenAI call costs use illustrative rates; add actual per-model pricing and richer per-call inspection next. The stronger-model judging gate is fallible and not a mathematical proof checker.
- Export is JSON; import/restore UI is not implemented. Back up userData manually. No streaming token display or durable cross-restart job queue; pools persist and refill resumes on startup.
- No grading sandbox, Anki import, PDF/video/image ingestion, auth, shared bank, mobile, voice, boss cards, OS scheduled jobs, tray, notifications, auto-update, signing or notarization. The provider and deterministic verifier interfaces are extension points for a later version.
