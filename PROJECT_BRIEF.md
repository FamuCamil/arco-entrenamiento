---
schema_version: 1
project:
  name: arco-entrenamiento
  maturity_target: mvp
stack:
  languages: [TypeScript, HTML, CSS]
  frameworks: [Vue 3.5, Pinia, Vue Router 4, Vite, vite-plugin-pwa, Vitest, Playwright]
  runtimes: [browser]
  versions:
    node: "26.11.1"
    npm: "11.20.0"
    vue: "^3.5.44"
    vue_router: "^4.6.4"
    pinia: "^4.1.0"
    vite: "^8.3.4"
    vitejs_plugin_vue: "^6.0.10"
    vite_plugin_pwa: "^2.0.0"
    workbox_window: "^7.4.1"
    vitest: "^5.0.4"
    vue_tsc: "^3.3.13"
    typescript: "~6.0.3"
    playwright_test: "^1.64.1"
  data_stores: ["localStorage (primary; key archery-training:v1; accessed only through usePersistence)"]
build:
  tool: npm
  commands:
    test: "npm run test"
    lint: "npm run lint"
    format: "npm run format"
    typecheck: "npm run typecheck"
    build: "npm run build"
    test_e2e: "npm run test:e2e"
paths:
  production: ["src/**", "public/**", "index.html", "vite.config.ts", "tsconfig*.json", "env.d.ts", "package.json", "package-lock.json", "eslint.config.js", ".prettierrc.json", "playwright.config.ts", ".github/**"]
  test: ["src/**/*.test.ts", "tests/**", "e2e/**"]
  api_boundary: []
test:
  framework: vitest
  levels: [unit, e2e]
  coverage_target: "90% lines on src/domain/** and src/composables/** (no global gate)"
profiles: []
deployment:
  provider: github-pages
  iac: none
  environments: [prod]
vcs:
  enabled: true
  already_initialized: false
  default_branch: main
  remote: https://github.com/FamuCamil/arco-entrenamiento.git
use_cases:
  index: null
  folder: null
---

# Project Brief

Source specification: `/Users/deebryl/Documents/arco-entrenamiento-analisis-y-plan.md` (Spanish, written by the user). This brief carries the key decisions from it in English. The spec remains the reference for fine detail (reference-app analysis in its section 2, SVG geometry in 6.2). If the brief and the spec disagree, **this brief wins**. Agents surface the conflict and don't pick silently.

**App UI language: Spanish.** All user-facing strings, labels, dialogs, and the PWA manifest are in Spanish (`<html lang="es">`). Code identifiers, comments, and commit messages are in English.

## Confirmed Decisions

All open decisions are resolved. The user confirmed them on 2026-10-15, relayed by the root session. There are no open decisions left.

| ID | Topic | Decision |
|---|---|---|
| - | Spec 9.1: distribution | PWA on GitHub Pages, deployed by GitHub Actions on push to `main`. Hash router (`createWebHashHistory`, `base: './'`) |
| - | Spec 9.4/9.5: styling and theme | Own CSS with `:root` tokens, no Tailwind. Light and dark themes via `prefers-color-scheme` |
| D1 | Spec 9.2: storage | `localStorage` first (key `archery-training:v1`), encapsulated behind `usePersistence` (`version: 1` + migrations, `navigator.storage.persist()` requested), so it can move to IndexedDB later without touching views |
| D2 | CU-19 multiple archers | Later (F5), not MVP. The data model keeps `archers[]`, but the MVP creates exactly one archer |
| D3 | CU-22 impact marking | Later (F5), not MVP |
| D4 | Coverage target | 90% lines on `src/domain/**` and `src/composables/**`, no global gate (`@vitest/coverage-v8`) |
| D5 | Lint / format | ESLint flat config (`eslint-plugin-vue` + `@vue/eslint-config-typescript`) + Prettier (`@vue/eslint-config-prettier`) |
| D6 | Test levels | Unit (Vitest) + end-to-end (Playwright, mobile viewport ~375 px, specs in `e2e/`) |
| D7 | Dependency hygiene | `npm audit` in CI only. No Dependabot |
| D8 | License | MIT, copyright 2026 Fanny (`LICENSE`) |
| D9 | Git remote | `https://github.com/FamuCamil/arco-entrenamiento.git` (added 2026-10-15) |
| D10 | CU-15 phase (spec inconsistency between sections 4 and 8) | CU-15 export/import JSON is **MVP**, delivered in F2. Resolved in the Phase Plan below |
| D11 | TypeScript | `~6.0.3` (TS 7 not adopted until vue-tsc / typescript-eslint support it) |
| D12 | Vue Router | `^4.6.4` (v4 as in the spec, not v5) |

## Overview

- **name:** arco-entrenamiento
- **problem:** An archer has no good way to record training-session scores on a phone at the range. The scoring web app used at competitions (ArcheryReg Scoring) only works for registered competitions via QR and keeps no personal history.
- **users:**
  1. The author: a single archer at the range, phone in one hand, entering each end quickly between shooting rounds (primary).
  2. (Later, CU-19) Training partners shooting on the same target (positions A-D), scored from the author's phone.
- **value_proposition:** Reproduces the familiar ArcheryReg Scoring entry experience, adapted to self-created training sessions. It works fully offline, is installable as a PWA, keeps all data on the device (no accounts, no server), and adds history and statistics that the original lacks. Differentiation: *simpler* and *more private*, plus personal history.
- **maturity_target:** mvp. The MVP is phases F0-F2, including CU-15. F3-F5 come later.
- **in_scope (MVP):**
  1. Create training sessions from templates or custom structures (CU-01, CU-02).
  2. Fast arrow scoring with a target-specific keypad, auto-advance, correction, delete arrow/end, and auto-sort of completed ends (CU-03 to CU-06).
  3. Live totals, averages, and a session summary with tie-break counts (CU-07, CU-08).
  4. Session list, edit, close/reopen (read-only), delete with an in-app dialog (CU-09 to CU-12).
  5. Offline-first installable PWA with local persistence and JSON export/import (CU-13 to CU-15).
- **non_goals:**
  1. No competitions, registrations, shifts, or time windows (no QR flow).
  2. No backend, no accounts, no server-side storage, no API sync, no multi-device sync.
  3. No reuse of the original's React/Zustand code. It is only a behavioral reference.
  4. No native app-store distribution (PWA only).
  5. No feature work beyond the MVP until F0-F2 are done (F3-F5 are deferred).
- **success_criteria:**
  1. F0-F2 give a working replacement for the original during training.
  2. Per-phase Definition of Done (see Phase Plan) is met: domain tests pass, `vue-tsc --noEmit` is clean, the app is verified on a real phone or at 375 px width, it works in airplane mode after the first load, and data survives a page reload.
  3. Scoring an arrow feels instant, and the selected row stays visible without manual scrolling.

### Context: adaptation from the reference app (spec section 3)

| Original (ArcheryReg) | Training version |
|---|---|
| Competition + shift + target (from QR) | **Session** created by the user: date, location, distance, target face, structure |
| Registration / participant | **Archer** of the session (default: just me; optionally up to 4, A-D) |
| Open/closed time window | **Close session** (read-only) / **Reopen** |
| API sync (saved/pending/error per end) | None: immediate local save + export/import |
| Competition screen | Session header / detail |

Original behaviors to **correct** (spec 2.5): points always come from each zone's `points` (never `parseInt(key)`, field X=6, 3D has 11). The per-arrow max is the max zone points of the face (not a fixed 10). Keypad colors are defined per zone (not inferred from key text).

### Use cases (spec section 4)

**MVP (must-have):**

| ID | Use case | Acceptance detail |
|---|---|---|
| CU-01 | Create session from template | Template (see Templates) pre-fills distance, face, series, ends/series, arrows/end. Everything is editable before creating. Date defaults to today. |
| CU-02 | Create custom session | Free values: series >= 1, ends per series >= 1, arrows per end 1-12, any catalog face. |
| CU-03 | Score arrows | Face-specific keypad, auto-advance, first empty cell selected on entry. |
| CU-04 | Correct an arrow | Tapping a cell selects it. The next key press overwrites it. |
| CU-05 | Delete arrow / delete end | "Borrar flecha" empties the selected cell. "Borrar tanda" empties the end and selects its first cell. |
| CU-06 | Auto-sort | When an end is complete, it is sorted best to worst zone. |
| CU-07 | Live totals | End total/max, series running total, series total/max, grand total/max, average per arrow. |
| CU-08 | Session summary | Table like the original's, with tie-break counts (10+X and 9, depending on the face). |
| CU-09 | Session list | Newest first. Each card shows date, location, distance, face icon, structure (`2x10x3`), total, average. |
| CU-10 | Close / reopen session | A closed session is read-only, with a lock in place of the keypad. |
| CU-11 | Edit session data | Date, location, distance, notes. Structure and face are locked once any arrow exists. |
| CU-12 | Delete session | Confirmation via an in-app dialog (never `window.confirm`). |
| CU-13 | Work offline | After the first load the app works without network, and data persists across restarts. |
| CU-14 | Install on phone | Manifest + service worker. "Add to home screen". |
| CU-15 | Export / import | JSON export of all sessions. Import merges by `id`, and the version with the newest `updatedAt` wins. Delivered in F2 (D10). |

**Desirable (later phases):**

| ID | Use case |
|---|---|
| CU-16 | History filterable by distance, face, and date range |
| CU-17 | Statistics: average-per-arrow and session-total evolution (chart), best score per template/distance, zone distribution (count of X, 10, 9...) |
| CU-18 | Notes per session and per end (wind, feelings, sight adjustments) |
| CU-19 | Multiple archers A-D in one session, with add/remove archers (F5, D2) |
| CU-20 | CSV export |
| CU-21 | Profile: default archer name and division (Recurve, Compound, Traditional, Barebow, Longbow) |

**Optional:**

| ID | Use case |
|---|---|
| CU-22 | Mark each arrow's impact by tapping the target drawing (zone computed automatically), for grouping analysis (F5, D3) |
| CU-23 | Equipment profiles (bow, arrows) attached to each session |
| CU-24 | Field/3D mode with starting-end rotation (`start_by_position`) |

These IDs are the spec's catalog. Formal use-case files are created later, one at a time, via `define-use-case` (which will create `USE_CASES.md` and `use-cases/`).

### Non-functional requirements (spec section 5)

- **Mobile-first:** keypad buttons at least 48x48 px, one-handed use, no horizontal scroll, respects `env(safe-area-inset-*)`.
- **Performance:** instant response on key press. The grid auto-scrolls to keep the selected row visible.
- **Local data:** `localStorage` behind `usePersistence` (D1). Request `navigator.storage.persist()`.
- **Schema versioning:** persisted state carries `version: 1`, with a migration function.
- **Accessibility:** sufficient contrast, `aria-label` on icon buttons, visible focus.
- **Language:** Spanish.
- **Theme:** light and dark via `prefers-color-scheme`, driven by CSS custom properties (confirmed).
- **IDs:** `crypto.randomUUID()` with an own fallback, because it is unavailable over plain `http://` on a LAN IP (phone testing).

## Domain

### Data model (spec 6.1)

```ts
type End = (string | null)[]           // one end: zone key per arrow, null = empty

interface ScoringZone { key: string; points: number; order: number; bg: string; fg: string }
interface TargetFace  { id: string; name: string; icon: TargetIcon; zones: ScoringZone[] }
type TargetIcon = 'wa-full' | 'wa-reduced' | 'wa-triple-vertical' | 'wa-triple-horizontal' | 'wa-field' | '3d'

interface Archer {
  id: string
  name: string
  position: 'A' | 'B' | 'C' | 'D'
  ends: End[]                          // length = seriesCount * endsPerSeries
}

interface Session {
  id: string
  date: string                         // YYYY-MM-DD
  location: string
  distance: number                     // meters (0 = variable: field/3D)
  faceId: string
  seriesCount: number
  endsPerSeries: number
  arrowsPerEnd: number
  archers: Archer[]
  notes: string
  closed: boolean                      // closed = read-only
  createdAt: number
  updatedAt: number
}

interface PersistedState { version: 1; sessions: Session[]; profileName: string }
```

`ends[row][arrow]` is a flat row matrix. The series of a row is `Math.floor(row / endsPerSeries)`.

### Target-face catalog (spec 6.2)

| id | Name | Icon | Zones (key:points) |
|---|---|---|---|
| `wa-122` | WA 122 cm | wa-full | X:10, 10...1, M:0 |
| `wa-80` | WA 80 cm | wa-full | X:10, 10...1, M:0 |
| `wa-80-6` | WA 80 cm reducida (6 anillos) | wa-reduced | X:10, 10...5, M:0 |
| `wa-60` | WA 60 cm | wa-full | X:10, 10...1, M:0 |
| `wa-40` | WA 40 cm | wa-full | X:10, 10...1, M:0 |
| `wa-40-triple` | WA 40 cm triple | wa-triple-vertical | X:10, 10...6, M:0 |
| `wa-field` | WA Campo | wa-field | X:6, 6...1, M:0 |
| `3d` | 3D | 3d | 11, 10, 8, 5, M:0 |

**Zone (keypad) colors**, defined per zone in the catalog (`bg`/`fg`):
- X / 10 / 9: yellow `#facc15`
- 8 / 7: red `#ef4444`
- 6 / 5: blue `#3b82f6`
- 4 / 3: black `#111827`
- 2 / 1: white `#ffffff` (with border)
- M: grey `#d1d5db`
- **Field face:** 6 / 5 yellow, everything else black.
- 3D zone colors aren't specified in the spec. The implementing use case decides them and records them in the catalog.

**Target icon SVG geometry** (full face `viewBox="-70 -70 140 140"`): white r=60.9, black 48.7, blue `#00B4E4` 36.5, red `#F65058` 24.3, yellow `#FFE552` 12.1. Intermediate lines at 54.85, 42.65, 30.45, 18.25, 6.05, and the X at 3.045. The reduced face draws only from blue inward (`viewBox -40 -40 80 80`). The triple uses three spots of r=9.9/7.9/3.9 spaced 22 units apart.

### Templates (spec 6.3)

| Template (UI label) | Distance (m) | Face | Series x Ends x Arrows |
|---|---|---|---|
| Sala 18 m | 18 | wa-40 | 2 x 10 x 3 |
| Sala 18 m triple | 18 | wa-40-triple | 2 x 10 x 3 |
| Sala 25 m | 25 | wa-60 | 2 x 10 x 3 |
| Aire libre 70 m | 70 | wa-122 | 2 x 6 x 6 |
| Aire libre 50 m compuesto | 50 | wa-80-6 | 2 x 6 x 6 |
| Aire libre 30 m | 30 | wa-80 | 2 x 6 x 6 |
| Campo | variable (0) | wa-field | 2 x 12 x 3 |
| 3D | variable (0) | 3d | 2 x 12 x 2 |
| Personalizada | free | free | free |

### Scoring rules (spec 6.4): pure functions in `src/domain/scoring.ts`, unit-tested

- `zonePoints(key, face)`: the zone's `points`. 0 if `null` or the key doesn't exist.
- `maxArrowPoints(face)`: max `points` across the face's zones.
- `endTotal(end)`: sum of arrow points. End max = `arrowsPerEnd x maxArrowPoints`.
- `seriesRunningTotal(ends, row)`: sum from the first end of the row's series up to `row`.
- `seriesTotal(ends, series)`: max = `endsPerSeries x arrowsPerEnd x maxArrowPoints`.
- `grandTotal(ends)`: max = `rows x arrowsPerEnd x maxArrowPoints`.
- `averagePerArrow(ends)`: total / **shot** arrows (non-null), 2 decimals. `null` if none were shot.
- `sortEnd(end, face)`: ascending by zone `order`, empties last. Applied **only when the end is complete**, both on completion and when correcting an arrow of an already-complete end.
- `topCounts(ends, face)`: the first two zones by `order`, excluding X and M. X adds to the first if it has equal points, otherwise to the second if it equals that one.
- `firstEmptyCell(ends)`: first `null` cell. If none, the last cell.
- `nextCell(cell)`: next arrow. At the end of a row, the first arrow of the next row. At the last cell of the session, it stays put.
- *(CU-24)* Displayed end number with `start_by_position`: `((row % endsPerSeries) + offset) % endsPerSeries + 1`.

**Minimum test cases (mandatory):**
- `['X','9','M']` on WA 40 -> 19
- `['X','6',null]` on field -> 12
- `['11','5']` on 3D -> 16
- `sortEnd(['7','M','X','10'])` -> `['X','10','7','M']`
- `topCounts([['X','10','9'],['9','8','X']])` on WA 40 -> 10: 3, 9: 2
- Average of `[['10','9'],['8',null]]` -> 9.00

## Monetization

- **commercial_intent:** no
- **model:** none (personal tool)
- **license:** MIT (`LICENSE`, copyright 2026 Fanny)
- **target_market:** personal use by the author (and optionally training partners on the same device)
- **tiers:** none
- **constraints:**
  - No backend, no accounts, no analytics/tracking, no ads. All data stays on the device and leaves it only through explicit user export.
  - Zero running cost (static hosting on GitHub Pages).

## Technologies

- **constraints:** Vue 3 with Composition API (user-confirmed). Own CSS with `:root` tokens, **no Tailwind** (confirmed). npm on ARM Node from `/opt/homebrew/bin` (the x86 Node in `/usr/local` is broken and must not be used). Don't install or modify system software without asking the user.
- **runtimes:** browser (mobile-first, installed PWA). Node is only for the build toolchain.
- **languages:** TypeScript (strict) for app code (browser) and build config (Node). HTML. CSS.
- **frameworks / key libraries (browser):**
  - Vue 3.5 SFCs with `<script setup lang="ts">`, Composition API
  - Pinia (setup stores)
  - Vue Router 4 (`^4.6.4`, D12), `createWebHashHistory`, `base: './'` (static hosting, no redirects needed).
  - vite-plugin-pwa (Workbox, `registerType: 'autoUpdate'`)
  - Charts (F3/F4 only, deferred): Chart.js via vue-chartjs, or own SVG. Decided by the CU-17 use case.
- **frameworks (build/test, Node):** Vite, Vitest, vue-tsc, TypeScript `~6.0.3` (D11). jsdom + @vue/test-utils for composable/component tests. Playwright (`@playwright/test`) for end-to-end tests.
- **data_stores:** `localStorage` key `archery-training:v1`, only via `usePersistence` (versioned load/save + migrations), designed for a later IndexedDB swap without touching views (D1).
- **auth_strategy:** none (single-user, device-local).
- **external_services:** none at runtime. GitHub Pages + GitHub Actions for hosting/CI.
- **ai_ml_dependency:** none.
- **toolchain:** Node 26.11.1 / npm 11.20.0 (Homebrew ARM). `/opt/homebrew/bin` is first on PATH in this environment. If it isn't on PATH, use `/opt/homebrew/bin/npm` and `/opt/homebrew/bin/npx`.
- **version pins:** see `stack.versions` in the frontmatter (looked up from the npm registry on 2026-10-15; caret ranges in `package.json`).
- **build commands** (npm scripts, defined at scaffold time):
  - `npm run dev`: `vite`
  - `npm run build`: `vue-tsc --build && vite build`
  - `npm run preview`: `vite preview`
  - `npm run typecheck`: `vue-tsc --build` (the solution-style `tsconfig.json` has `files: []` and project references, so `--build` is the form that actually checks the app and node projects. Both projects set `noEmit`. This satisfies the Definition of Done's "`vue-tsc --noEmit` clean" requirement)
  - `npm run test`: `vitest run`
  - `npm run test:watch`: `vitest`
  - `npm run coverage`: `vitest run --coverage`
  - `npm run test:e2e`: `playwright test` (needs the one-time browser download `npx playwright install`, see Development)
  - `npm run lint`: `eslint .`
  - `npm run format`: `prettier --write .`

## Architecture

- **platforms:** web (mobile-first PWA, installable on Android/iOS home screen; also usable on desktop browsers).
- **service_shape:** single client-side SPA (monolith). No server.
- **components:**
  - `domain/`: pure TS. Target-face catalog, templates, scoring functions. No Vue imports.
  - `stores/sessions.ts`: Pinia setup store, the single owner of app state and mutations.
  - `composables/`: `useScoring`, `useSessionStats`, `usePersistence`, `useConfirm`.
  - `components/` + `views/`: Vue SFC presentation.
  - Service worker (generated by vite-plugin-pwa / Workbox): precaches the app shell for offline use.
- **communication:** in-process only. Views -> composables -> store -> `usePersistence` -> `localStorage`. Service worker <-> browser cache.
- **async_workloads:** none (service-worker auto-update only).
- **integrations:** none. Export/import is via user-chosen JSON files.
- **data_flow_narrative:** The user creates a session (template or custom) -> the store creates a `Session` with one `Archer` and an empty `ends` matrix. On the scoring screen, a key press calls `useScoring.score(key)` -> `store.setArrow(...)` (no-op if closed; sorts the end if complete) -> `nextCell`. A deep `watch` in the store persists `PersistedState` through `usePersistence` (try/catch). Totals and stats are `computed` from the domain functions. Export serializes all sessions to JSON. Import parses, validates/migrates, and merges by `id` (newest `updatedAt` wins).
- **trust_boundaries:** Untrusted input enters only through imported JSON files and the restored `localStorage` contents. Both must be schema-validated/migrated before use, and malformed data must never crash the app or overwrite good data silently. No sensitive data. Nothing leaves the device except user-initiated exports.
- **multi_tenancy:** not applicable.

### Folder layout (spec 7.2)

```
src/
  main.ts
  App.vue                     # header + <RouterView>
  router/index.ts
  styles/tokens.css           # :root tokens, light/dark via prefers-color-scheme, zone colors
  domain/
    targetFaces.ts            # face catalog (Domain > catalog)
    templates.ts              # templates
    scoring.ts                # pure functions
    scoring.test.ts
  stores/
    sessions.ts               # Pinia setup store + persistence
  composables/
    useScoring.ts             # selected cell, score, delete, advance, auto-scroll
    useSessionStats.ts        # derived totals/averages (computed)
    usePersistence.ts         # versioned load/save + migrations
    useConfirm.ts             # in-app confirmation dialog
  components/
    TargetIcon.vue            # SVG per face type
    ScoreGrid.vue             # series/ends/arrows table
    ScoreCell.vue
    ScoreKeypad.vue           # one button per zone
    ScoreActions.vue          # Borrar flecha / Borrar tanda
    ArcherCard.vue            # card with last end + total
    SummaryTable.vue          # summary table with counts
    SessionCard.vue
    ConfirmDialog.vue
  views/
    SessionsView.vue          # list + export/import
    NewSessionView.vue        # templates + form
    SessionView.vue           # detail + archers
    ScoringView.vue           # scoring (main screen)
    SummaryView.vue           # summary (optional ?archer=<id>)
    StatsView.vue             # phase F4
```

Unit tests live next to their subject as `*.test.ts` (QA scope), plus an optional top-level `tests/` for shared fixtures. Playwright end-to-end specs live in `e2e/` (`*.spec.ts`).

### Routes (spec 7.3, hash history)

| Route | View | Original equivalent |
|---|---|---|
| `/` | SessionsView | - |
| `/new` | NewSessionView | - |
| `/session/:id` | SessionView | Competition + Participants |
| `/session/:id/score/:archerId` | ScoringView | Scoring |
| `/session/:id/summary` (`?archer=`) | SummaryView | Summary |
| `/stats` | StatsView | - (F4) |

If a session has a single archer, creating or opening it may go straight to the scoring screen.

### Store `useSessionsStore` (spec 7.4, setup store)

- **State:** `sessions`, `profileName`.
- **Getters:** `sortedSessions`, `getSession(id)`, `getArcher(sessionId, archerId)`.
- **Actions:** `createSession(input)`, `updateSession(id, patch)`, `deleteSession(id)`, `setClosed(id, closed)`, `setArrow(sessionId, archerId, row, arrow, key | null)` (applies `sortEnd` when the end becomes complete; no-op when the session is closed), `deleteEnd(...)`, `addArcher(...)`, `removeArcher(...)` (at least one archer always remains), `exportJson()`, `importJson(text)`.
- **Persistence:** `watch(..., { deep: true })` saves through `usePersistence` (key `archery-training:v1`), wrapped in try/catch.

### Composable `useScoring(sessionId, archerId)` (spec 7.5)

Returns: `selected` (`ref<{row, col}>`, initialized with `firstEmptyCell`), `select(row, col)`, `score(key)` (calls `setArrow` then `nextCell`), `deleteArrow()`, `deleteEnd()` (returns to the end's first arrow), `isLocked` (computed from `closed`), `average` / `total` / `max` (computed), `activeRowRef` (for `scrollIntoView({ block: 'nearest' })` when the row changes).

### Scoring screen behavior (from the reference app, spec 2.4 item 4)

Header with archer name and average per arrow (`Promedio: 8.67`). One block per series (`Serie 1`), one row per end, one column per arrow, plus end total vs max (`27/30`) and series running total. Each series closes with `Total Serie n: X/max`, and the table ends with `TOTAL GENERAL: X/max`. The selected cell is highlighted. Keypad buttons are colored like the rings. A lock replaces the keypad when the session is closed ("Sesión finalizada - solo lectura"). A button opens the summary. Summary: per archer, ends, end total, running total, and two tie-break columns (top two numeric zones, X merged per `topCounts`), plus per-series and grand totals.

## Phase Plan (spec section 8)

| Phase | Deliverable | Use cases | Estimate |
|---|---|---|---|
| **F0 - Base** | Vite + Vue 3 + TS + Pinia + Router + PWA + Vitest project. Mobile layout, color tokens (light/dark), GitHub Pages deployment via GitHub Actions | CU-13, CU-14 | 0.5 d |
| **F1 - Scoring core** | `targetFaces`, `templates`, `scoring` with tests. Store with persistence. `TargetIcon`, `ScoreGrid`, `ScoreKeypad`, `ScoreActions`. `ScoringView` with `useScoring` | CU-03 to CU-07 | 2 d |
| **F2 - Sessions** | `NewSessionView` (templates + form), `SessionsView`, `SessionView`, `SummaryView`, close/reopen, edit, delete with dialog, JSON export/import | CU-01, CU-02, CU-08 to CU-12, CU-15 | 1 d |
| **F3 - Data & history** | CSV export, filterable history, per-end notes | CU-16, CU-18, CU-20 | 1 d |
| **F4 - Statistics** | `StatsView`: average/total evolution, best scores, zone distribution | CU-17 | 1-1.5 d |
| **F5 - Extras** | Multiple archers A-D, profile, impact marking, equipment, field/3D rotation | CU-19, CU-21 to CU-24 | scope-dependent |

**MVP = F0 + F1 + F2** (CU-01 to CU-15). CU-15 moved from F3 to F2 (D10), because export is the only backup path for device-local data. The structure-only scaffold (below) covers part of F0's tooling. The F0 use cases still deliver the PWA manifest/icons, offline verification, mobile layout, and the first successful deploy.

**Definition of Done (every phase):** domain tests pass. `vue-tsc --noEmit` reports no errors. The app is checked on a real phone (or devtools at 375 px width). It works in airplane mode after the first load. Data survives a page reload.

## Quality & Standards

- **style_guide:** language/framework defaults: Vue official style guide (priority A+B rules), `<script setup lang="ts">` only, Composition API only, strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`). Domain code is pure (no Vue/DOM imports in `src/domain/`).
- **linters_formatters:** TypeScript/Vue: ESLint flat config (`eslint-plugin-vue`, `@vue/eslint-config-typescript`) + Prettier (`@vue/eslint-config-prettier`) (D5). Type-checking via `vue-tsc --noEmit`.
- **testing:**
  - levels: unit (domain pure functions; composables/store with jsdom) + e2e (Playwright, mobile viewport ~375 px, against `vite preview`) (D6)
  - frameworks: Vitest (+ @vue/test-utils, jsdom, @vitest/coverage-v8), Playwright (`@playwright/test`)
  - coverage_target: 90% lines on `src/domain/**` and `src/composables/**`, no global gate (D4)
  - The minimum scoring test cases listed in Domain are mandatory.
  - Manual: mobile (or 375 px) check and airplane-mode check per the Definition of Done.
- **security:** no backend or secrets. `npm audit --omit=dev --audit-level=high` in CI (shipped dependencies only; dev-tool advisories are reviewed manually with a full `npm audit`). No Dependabot (D7). Validate imported JSON and restored storage. No `v-html` with user data. No threat-model document (no server or trust-sensitive surface).
- **accessibility_target:** WCAG 2.2 AA-oriented (derived from the spec: sufficient contrast in both themes, `aria-label` on icon buttons, visible focus, 48x48 px minimum touch targets).
- **performance_budgets:** instant (< 100 ms perceived) response to a keypad press. Selected row auto-scrolled into view. No horizontal scroll at 375 px. No hard bundle-size budget.
- **documentation:** README (setup, scripts, deploy) + this brief + the source spec. No ADRs.
- **observability:** none (client-only. Errors are caught around persistence and surfaced to the user in Spanish).
- **profiles:** none (no workspace profile applies to a Vue/TS client-only app).

## Profiles

None

## Deployment

### Production

- **hosting:** GitHub Pages (static), PWA (confirmed).
- **cloud:** GitHub (Pages).
- **iac:** none (GitHub Pages is configured with "Source: GitHub Actions" in repo settings, a manual one-time step for the user).
- **ci_cd:** GitHub Actions. On push to `main`: `npm ci` -> `npm audit --omit=dev --audit-level=high` -> `npm run typecheck` -> `npm run lint` -> `npm run test` -> `npm run build` -> `npx playwright install --with-deps chromium` -> `npm run test:e2e` -> upload `dist/` and deploy with `actions/deploy-pages`. Pull requests run the same checks without deploying.
- **environments:** prod only.
- **secrets:** none (uses the built-in `GITHUB_TOKEN` with `pages: write`, `id-token: write`).
- **observability:** none.
- **dr:** user-driven JSON export/import (CU-15). Data lives only on the device. `navigator.storage.persist()` is requested to reduce eviction risk.
- **routing:** hash history + `base: './'` so the app works under any `/<repo>/` subpath without 404 redirects.

### Development

- **environment:** native toolchain: Homebrew ARM Node 26.11.1 / npm 11.20.0 (`/opt/homebrew/bin`). `.nvmrc` pins major 26 for CI.
- **containerization:** not used.
- **e2e browsers:** `npx playwright install` (or `npx playwright install chromium`) is a **one-time local step** that downloads the Playwright browsers. The scaffold does not run it. The user must approve it before anyone runs it locally. CI downloads Chromium on every run.
- **hot_reload:** Vite dev server HMR (`npm run dev`). Phone testing over LAN with `vite --host` (hence the `crypto.randomUUID` fallback).
- **seed_data:** none in the app. Test fixtures in `*.test.ts` / `tests/`.
- **migrations:** persisted-state schema migrations in `usePersistence` (`version` field).

## Scaffolding Plan

**Status: DONE (2026-10-15).** Approved by the user. All files listed below exist. `git init -b main` and `npm install` ran. Lint, typecheck, unit tests (none yet, `passWithNoTests`) and build all pass.

Deviations recorded during execution:
- `src/router/`, `src/views/`, `src/styles/`, `.github/workflows/`, `.claude/` were created as parents of the listed files.
- `.prettierignore` also ignores `PROJECT_BRIEF.md`, `USE_CASES.md`, `use-cases/` (skill-maintained Markdown).
- `typecheck`/`build` use `vue-tsc --build` instead of `vue-tsc --noEmit` (see Technologies).
- **Known issue (mitigated 2026-10-15):** full `npm audit --audit-level=high` reports 4 high findings in a dev-only chain (`@vue/eslint-config-typescript` -> `fast-glob` -> `micromatch` -> `braces`, GHSA-vfj7-8cjw-p6xm). No non-breaking fix exists. Mitigation chosen by the user: CI audits production dependencies only (`--omit=dev`), which report 0 vulnerabilities. Revisit when `@vue/eslint-config-typescript` ships a fixed release.

Structure and tooling config only. Structure and tooling config only. No feature code (no domain logic, store, composables, or real views).

### Directories (one `mkdir -p` call, for otherwise-empty directories that get a `.gitkeep`)

`mkdir -p <TARGET_DIR>/src/domain <TARGET_DIR>/src/stores <TARGET_DIR>/src/composables <TARGET_DIR>/src/components <TARGET_DIR>/public <TARGET_DIR>/e2e`

### Files

| Path | Purpose |
|---|---|
| `.gitignore` | Ignore `node_modules/`, `dist/`, `dev-dist/`, `coverage/`, `.vite/`, `test-results/`, `playwright-report/`, `*.local`, `.DS_Store`, editor folders |
| `.editorconfig` | 2-space indent, LF, UTF-8, final newline |
| `.nvmrc` | `26`: Node major for CI (`actions/setup-node` `node-version-file`) |
| `.prettierrc.json` | Prettier options (single quotes, no semicolons, width 100) |
| `.prettierignore` | Ignore `dist/`, `coverage/`, `dev-dist/`, Playwright output, lockfile |
| `eslint.config.js` | ESLint flat config: vue recommended + typescript + prettier-skip-formatting |
| `package.json` | `name`, `private: true`, `type: module`, `license: MIT`, the npm scripts listed in Technologies (including `test:e2e`), dependencies/devDependencies with the pinned ranges (including `@playwright/test`) |
| `LICENSE` | MIT, copyright 2026 Fanny |
| `index.html` | `<html lang="es">`, `viewport-fit=cover` meta, `theme-color` light/dark metas, `#app` mount, `/src/main.ts` entry |
| `vite.config.ts` | `base: './'`, `@vitejs/plugin-vue`, `VitePWA({ registerType: 'autoUpdate', manifest: { lang: 'es', name/short_name, display: 'standalone' } })` (icons left to the F0 use case), Vitest `test` block (`environment: 'jsdom'`, `include: src/**/*.test.ts`, `passWithNoTests: true`, coverage-v8 config with 90% line thresholds on domain/composables) |
| `playwright.config.ts` | `testDir: 'e2e'`, mobile project (~375 px viewport, touch), `webServer` = `npm run build && npm run preview` on a fixed port, `baseURL` |
| `tsconfig.json` | Solution-style references to app + node configs |
| `tsconfig.app.json` | Extends `@vue/tsconfig/tsconfig.dom.json`. `strict`, `noUncheckedIndexedAccess`, `include: src/**, env.d.ts` |
| `tsconfig.node.json` | For `vite.config.ts` / `playwright.config.ts` / `e2e/**` (Node types) |
| `env.d.ts` | `/// <reference types="vite/client" />` + `vite-plugin-pwa/client` types |
| `src/main.ts` | Bootstrap only: `createApp(App).use(createPinia()).use(router).mount('#app')` + import tokens.css |
| `src/App.vue` | Shell: header with the app title + `<RouterView />` |
| `src/router/index.ts` | `createRouter({ history: createWebHashHistory() })` with only the `/` route to `SessionsView` (other routes added by their use cases) |
| `src/views/SessionsView.vue` | Placeholder view ("Sesiones", empty-state text in Spanish) with a TODO pointing at CU-09 |
| `src/styles/tokens.css` | `:root` design tokens: zone colors from Domain, neutral surface/text/accent tokens for light + `@media (prefers-color-scheme: dark)` overrides, safe-area padding vars, 48 px min touch target var |
| `src/domain/.gitkeep` | Keep folder (catalog/templates/scoring arrive in F1 use cases) |
| `src/stores/.gitkeep` | Keep folder |
| `src/composables/.gitkeep` | Keep folder |
| `src/components/.gitkeep` | Keep folder |
| `public/.gitkeep` | Keep folder (PWA icons arrive in the F0 use case) |
| `e2e/.gitkeep` | Keep folder (Playwright specs arrive with their use cases) |
| `.github/workflows/deploy.yml` | CI: checks (audit, typecheck, lint, unit, build, e2e) on PR + push to `main`. Pages deploy on push to `main` (see Deployment) |
| `.claude/allowed-commands.yaml` | Dev-team Bash prefixes: `npm`, `npx`, `/opt/homebrew/bin/npm`, `/opt/homebrew/bin/npx`, `/opt/homebrew/bin/node` |
| `README.md` | Generated from this brief per the `write-readme` skill conventions (Spanish app, English README) |
| `package-lock.json` | Produced by `npm install` (step 2 below) |

### Commands (each a separate Bash call, in order, after the files are written)

1. `git -C /Users/deebryl/Documents/Proyectos/arco-entrenamiento init -b main`
2. `/opt/homebrew/bin/npm --prefix /Users/deebryl/Documents/Proyectos/arco-entrenamiento install` (user-approved). This creates `node_modules/` and `package-lock.json`.
3. Verification, run once: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` (via `/opt/homebrew/bin/npm --prefix <TARGET_DIR> run <script>`). Fix only scaffold-config issues.

Not run: `git remote add` (no remote yet, D9), `npx playwright install` (browser download needs separate user approval), `npm run test:e2e`, `git add`, `git commit`, `git push`. The user owns the first commit and push. One-time manual step for the user: GitHub repo Settings -> Pages -> Source: "GitHub Actions".
