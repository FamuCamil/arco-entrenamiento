---
plan_for: use-cases/07-funcionar-sin-conexion.md
work_branch: feat/uc-07-funcionar-sin-conexion
run: arco-entrenamiento-uc-7
approved: 2026-10-16
---

UC-07 (CU-13 Funcionar sin conexión): challenger-uc7 approved analyst-uc7's proposal in round 1 with 4 Minor notes. The notes are folded in below and marked [C1]–[C4]. The text below is the final proposal as sent by analyst-uc7.

## Challenger verdict: Approve
Checked against the source:
- vite-plugin-pwa 2.0.0, dist/index.js L826-876: the workbox options merge onto the plugin defaults.
- client/build/register.js: in autoUpdate mode it reloads only on `activated` with isUpdate/isExternal, never on first install.
- The router uses hash history, and ScoringView is lazy.
- public/ holds exactly the 6 icon files.

Minor notes, folded in below as [C1]–[C4]:
- [C1] skipWaiting and clientsClaim must be set explicitly, and their comment must say they are required.
- [C2] No reads of dist/ when the spec module loads.
- [C3] Set retries to 0 for the offline spec, or repeat-run it.
- [C4] The console allowlist is one named regex.

Recommendation: the public/ check reads the folder with readdir, so any file added to public/ later must be precached. That is intended, and the test comment says so.

### Analysis
TARGET_DIR = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion. Profiles: none.

Current behaviour, from vite-plugin-pwa 2.0.0 and workbox-build 7.4.1 in the main checkout's node_modules:
- The generateSW defaults already give navigateFallback 'index.html', cleanupOutdatedCaches, and globPatterns `**/*.{js,wasm,css,html}`.
- The plugin precaches the includeAssets files and the manifest icons as additionalManifestEntries with md5 revisions, plus manifest.webmanifest. public/ holds exactly those 6 files.
- Registration is the injected registerSW.js: a bare register of './sw.js' with no reload logic.
- Gap: ScoringView is lazy (src/router/index.ts:16). After a deploy, the new SW activates on open and precache cleanup deletes the old chunk. A page still running the old build then requests that chunk, Pages returns 404, and the dynamic import fails. A silent reload when the new SW takes control fixes this.

### Proposed Solution

**1. /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/vite.config.ts (developer)**

Inside VitePWA, keep `registerType: 'autoUpdate'`, the manifest, includeAssets and base './' unchanged. Add `injectRegister: false`, with a comment saying registration lives in src/main.ts. Add an explicit workbox block:
- `globPatterns: ['**/*.{js,css,html}']`. Comment: icons and the manifest are precached through includeAssets, the manifest icons and the plugin. Do NOT add png, svg or webmanifest here: the duplicate entries would get conflicting revisions and fail the build.
- `navigateFallback: 'index.html'`.
- `cleanupOutdatedCaches: true`.
- `skipWaiting: true` and `clientsClaim: true`. [C1] These are load-bearing. The plugin sets them for autoUpdate only when injectRegister is 'auto' or null (index.js ~L874), so `injectRegister: false` drops them. The comment must say that.
- No `runtimeCaching`, with a comment saying this is deliberate (AC4: nothing is cached at runtime, so nothing from other origins).
- No navigateFallbackDenylist. With hash routing, every navigation is the scope root.

**2. /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/src/main.ts (developer)**

Import `registerSW` from 'virtual:pwa-register'. The types are already available through vite-plugin-pwa/client in tsconfig.app.json, and workbox-window ^7.4.1 is already a devDependency. Call it once with `{ immediate: true }` and no callbacks, so no UI is added. Add a short English comment: updates are silent by user decision, and the page reloads once when a new SW takes control.

Behaviour, per node_modules/vite-plugin-pwa/dist/client/build/register.js:
- It reloads only when the `activated` event has isUpdate or isExternal set, so a first install never reloads.
- It is guarded by `'serviceWorker' in navigator`, and register errors are caught.
- The hash route and localStorage data survive the reload, because the store watch in src/stores/sessions.ts:109 persists every change.

Side effects:
- registerSW.js is no longer emitted.
- A workbox-window chunk lands in dist/assets and is precached by the js glob.
- The SW URL and scope stay './sw.js' and './', so e2e/install.spec.ts:272-283 stays valid.
- No unit test is needed, because nothing imports main.ts under Vitest.

**3. /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/e2e/offline.spec.ts (new, qa)**

House style follows e2e/install.spec.ts and e2e/scoring.spec.ts: the dom lib reference, a local trackConsole, and a cell() helper. [C2] Every fs read (the dist/assets list, dist/sw.js, the public/ list) happens inside the test bodies or in helpers they call, never at module top level. Playwright collects specs before webServer builds, so a top-level read would fail on a clean checkout. [C3] Add `test.describe.configure({ retries: 0 })` with a comment, so CI's `retries: 2` cannot hide flakiness in the offline flow. QA also runs `--repeat-each=5` locally and records the result in the file header.

**Test A: the precache covers the whole app shell (AC1, AC3/AC4 static checks)**
- List dist/assets. Expect at least one .css and at least two .js files (the entry plus the lazy chunk).
- Extract the precache URLs from dist/sw.js using the `url:"…"` entries, accepting either quote style.
- Assert the precache contains:
  - every dist/assets js and css file, as `assets/<name>`;
  - index.html;
  - manifest.webmanifest;
  - every file in public/, read with readdir. A comment explains that a future public/ file must be added to includeAssets or this test fails.
- Fetch './sw.js' through the request fixture and assert it equals the file on disk. This guards against a stale server reused locally.
- Assert sw.js contains exactly one `registerRoute(`, and that it is the NavigationRoute.
- Assert none of CacheFirst, NetworkFirst, StaleWhileRevalidate or NetworkOnly appear.
- Assert `skipWaiting()` and `clientsClaim()` are present.

**Test B: offline flow (AC2, AC3, AC5, AC6)**
1. Open './' with the network on. Wait for `navigator.serviceWorker.controller` to be non-null (15 s), then for `serviceWorker.ready`.
2. Runtime cache check. Every cached request URL is same-origin. Ignoring the `__WB_REVISION__` query, the precache contains index.html and every dist/assets file (the list is passed in from Node).
3. Click «Sesión de prueba» and score X, 9, 8.
4. Call `context.setOffline(true)`. Assert `navigator.onLine` is false, and that a `fetch('./__offline-probe__', {cache: 'no-store'})` rejects.
5. Reload. The response is non-null and `fromServiceWorker()` is true. The heading 'A - Yo' is visible, cells 0-0..0-2 show X/9/8, and the selection is at row 1, column 0.
6. Still offline, score 10. Reload and assert all four arrows.
7. Close the page and open `context.newPage()` with its own trackConsole. Go to the saved scoring URL while offline and assert the app and all four arrows (AC6).
8. Go to './?offline-fallback=1#/'. Only the NavigationRoute fallback can serve that URL. Expect «Sesión de prueba» to be visible (AC2).
9. Assert there is no `[role="alert"]`, and no visible text matching /sin conexión|actualizad|offline|disponible sin/i (AC3).
10. Console problems on both pages must be []. [C4] The only filter is a single named regex, /net::ERR_INTERNET_DISCONNECTED/, with a comment. There is no generic "Failed to load resource" filter.

**Test C: no service-worker support (AC4)**
- An addInitScript deletes `serviceWorker` from Navigator.prototype.
- Open './' and assert `navigator.serviceWorker` is undefined.
- Open the test session, score one arrow, reload, and assert it persisted.
- Strict console check, with no allowlist.

**Browser for this spec.** Use the default headless shell first. If an offline reload served by the SW fails or flakes there, set `test.use({ channel: 'chromium' })` at file level, following e2e/installability.spec.ts:12. CI already installs that Chromium. QA records the choice in the header comment.

**Unchanged:** playwright.config.ts (it already uses baseURL /arco-entrenamiento/ and 375 px), .github/workflows/deploy.yml, persistence, e2e/install.spec.ts, and README.md.

### Files Affected
- Production (developer):
  - /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/vite.config.ts
  - /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/src/main.ts
- Test (qa):
  - /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-07-funcionar-sin-conexion/e2e/offline.spec.ts (new)

### Risks & Considerations
- **AC1 is tested in Playwright, not Vitest.** deploy.yml runs `npm run test` before `npm run build`, so Vitest would find no dist/ there, or a stale one locally. The Playwright webServer always builds first, and the sw.js equality check covers a server reused locally.
- **The silent reload on update can drop an open ConfirmDialog.** This is accepted: scored data and the route survive. The rejected alternative was a `vite:preloadError` handler that reloads the page. It only patches the lazy-chunk failure and keeps the old build running.
- **No automated test of an actual version swap.** That would need two builds in one run, or intercepting the SW script fetch, which is unreliable. AC3 is covered by:
  - the static skipWaiting/clientsClaim assertions;
  - the cited register-module behaviour;
  - the no-notice assertion;
  - the user's manual check on the phone after deploy.
- **setOffline with service workers.** The risk is a false pass. It is mitigated by the probe-fetch rejection, the `fromServiceWorker()` check, the step-8 fallback URL, waiting for the controller before going offline, and retries set to 0.
- **NavigationRoute with no allowlist** answers every in-scope navigation with index.html. With relative assets this is correct at the scope root only, which is all that hash routing produces.
- **No new dependencies.** Storage is unchanged.
- **AC coverage:**
  - AC1: vite.config and Test A.
  - AC2: Test B steps 5 and 8.
  - AC3: autoUpdate with the virtual register, Test A, and Test B step 9.
  - AC4: no runtimeCaching, Test A, Test B step 2, and Test C.
  - AC5 and AC6: Test B.
  - AC7: the standard commands, with the CI order unchanged.
