---
plan_for: use-cases/06-instalar-en-movil.md
work_branch: feat/uc-06-instalar-en-movil
run: arco-entrenamiento-uc-6
approved: 2026-10-16
---

UC06 (arco-entrenamiento-uc-6): challenger-uc6 approves analyst-uc6's proposal rev 1 in round 1. The full approved proposal follows the verdict.

Orchestrator note: the two brief edits the plan needs are done. `paths.production` now includes `scripts/**` and `README.md`.

## Verdict: Approve

### Strengths
- **Grounded in the real plugin.** The analysis comes from the installed plugin source. Default injectRegister 'auto' resolves to 'script', and autoUpdate brings skipWaiting and clientsClaim. So the SW controls the first load (AC6) and updates stay silent, with no notices, as the user asked.
- **Paths tested under the real subpath.** Preview is served under `/arco-entrenamiento/`, which actually tests AC5, and relative-path assertions are added on top.
- **No new dependencies (AC7, AC8).** PNGs are rendered by the existing Playwright Chromium through Node 26 native TS, then committed. CI never regenerates them, which removes the ubuntu-vs-macOS rendering risk. The icon has no text either.
- **Pitfalls covered.** The iOS pitfall is handled with an opaque apple-touch-icon and a complete set of metas, including `mobile-web-app-capable` so the console guard doesn't trip. Maskable safe-zone geometry is computed and then tested with pixel checks.
- **UC07 boundary respected.** No globPatterns or navigateFallback changes and no offline tests. `includeAssets` only covers the three non-manifest icons.

### Issues Found (all Minor, no revision needed; for the developer and QA)
1. **Generator sizing.** Use a clip-based screenshot and assert each output's IHDR size in the script, so a Chromium minimum-window quirk at 32 px can't produce wrong dimensions.
2. **Node type stripping.** Use only erasable syntax and `.ts`-suffixed relative imports. `npm run icons` must run cleanly before the PNGs are committed.
3. **README scope.** Add only the scripts row and the "App icons" note. Leave "Status: scaffold only" and the `.gitkeep` removal alone, as scope creep.
4. **Console guard.** Any console-warning allow-list for the installability/CDP test stays scoped to that test. Never loosen `trackConsole` globally.
5. **`background_color` #111827** makes the splash dark in the light theme too. This is accepted under the use case's assumption. Mention it in the PR.

---

## APPROVED PROPOSAL (analyst-uc6, rev 1), verbatim

### Analysis
- **Current state.** `vite.config.ts` already sets `VitePWA({ registerType: 'autoUpdate', manifest: {...} })` with name «Arco · Entrenamientos», short_name «Arco», lang es, display standalone, start_url './', scope './', theme_color #111827, background_color #ffffff and `icons: []`. `public/` holds only `.gitkeep`. `index.html` has two `theme-color` metas (light #ffffff, dark #111827) and no icon or iOS metas.
- **How the SW registration is injected today.** I checked the installed vite-plugin-pwa 2.0.0 source (node_modules of the main checkout, dist/index.js lines ~253, ~391, ~799 and ~874), plus the output of a previous build in the main checkout's dist/.
  - `injectRegister` is not set, so it defaults to 'auto'. Nothing imports `virtual:pwa-register` (I grepped src/), so 'auto' resolves to 'script'.
  - The plugin emits `registerSW.js`, which on `window.load` calls `navigator.serviceWorker.register('./sw.js', { scope: './' })`. It injects `<script id="vite-plugin-pwa:register-sw" src="./registerSW.js">` into dist/index.html.
  - Because injectRegister is 'auto' and registerType is 'autoUpdate', the plugin forces Workbox `skipWaiting: true` and `clientsClaim: true`. The SW therefore takes control of the first page load without a reload (AC6), and updates happen silently with no prompt, which matches the "sin avisos" clarification.
- **How the manifest link resolves under `base: './'`.** `buildBase` defaults to the base path './'. dist/index.html gets `<link rel="manifest" href="./manifest.webmanifest">`, which is relative. The manifest's `start_url` and `scope` are './', resolved against the manifest URL, so both become `/arco-entrenamiento/` on Pages.
  - Manifest icon `src` values are resolved against the manifest URL. They must be bare relative names like `pwa-192x192.png`, with no leading '/'.
  - `includeManifestIcons` defaults to true, so the manifest icons are added to the Workbox precache automatically. Other public files are precached only if they are listed in `includeAssets` (the globs are relative to publicDir).
- **Existing e2e convention that constrains this run.** `e2e/scoring.spec.ts` `trackConsole` fails a test on any console warning or error. Two consequences:
  - Any manifest/icon warning Chrome logs (e.g. "Resource size is not correct") breaks the suite. That is useful as a guard.
  - The deprecated `apple-mobile-web-app-capable` meta on its own triggers a Chrome deprecation warning ("please include mobile-web-app-capable"). Both metas must be present.
  - All existing `page.goto` calls are relative ('./', `./${url}`), so a subpath baseURL works for them unchanged.
- **Header and status bar.** `App.vue` `.app-header` already pads with `--safe-top`. The header background is white in the light theme, so iOS `black-translucent` would put white status text on white. `default` lets iOS follow the existing light/dark `theme-color` metas.
- **Tooling.** Playwright Chromium (chromium-1248 + headless shell) is installed. Node 26 runs `.ts` files natively (type stripping), so a generator script needs no new dependency (AC7). PNG dimensions can be checked from the IHDR header and pixel content via a canvas in the page, so tests need no image library either.

### Proposed Solution

1. **Icon design and source SVG (AC1).** Create `public/favicon.svg`. It is the single source of truth for the artwork and is also served as the SVG favicon.
   - Square viewBox (e.g. 0 0 512 512), filled edge to edge with an opaque `#111827` rect.
   - A centered red `#F65058` disc with radius about 42% of the side.
   - A centered yellow `#FFE552` disc with half that radius, keeping the real face's 12.1/24.3 ratio.
   - Flat: no strokes, gradients, text, arrow or outer rings.
   - Why this way: the edge-to-edge opaque background avoids iOS's black fill of transparency, and the large disc stays recognizable at 16–32 px.
2. **Generator script (AC7).** Create `scripts/generate-icons.ts`, run with `node scripts/generate-icons.ts` (Node 26 native TS stripping, erasable syntax only, `import type` as `verbatimModuleSyntax` already requires).
   - It reads `public/favicon.svg` and launches Chromium through `chromium` from the existing `@playwright/test` devDependency.
   - For each output it opens a page with viewport size×size and deviceScaleFactor 1, a body with `#111827` background and zero margin, and the SVG as a data-URI `<img>`. It waits for decode and takes a PNG screenshot into `public/`.
   - Two compositions:
     - **"any"**: SVG drawn edge to edge. Produces `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon-180x180.png` and `favicon-32x32.png`.
     - **"maskable"**: SVG drawn at about 85% scale, centered on the `#111827` page. The red disc's radius is then about 0.36 of the side, inside the 0.40 safe-zone radius. Produces `maskable-icon-512x512.png`.
   - It exits non-zero on failure and logs each file written.
   - Add the npm script `"icons": "node scripts/generate-icons.ts"`.
   - Run it once and commit the generated PNGs, so build and CI never regenerate them.
   - No new dependency, nothing installed outside the project.
3. **`tsconfig.node.json`.** Add `scripts/**/*.ts` to `include` so `npm run typecheck` covers the script. ESLint already lints `**/*.ts`.
4. **`vite.config.ts` (AC3, AC5).**
   - Manifest: `background_color` '#111827', which matches the icon's dark field (the Android splash is icon on background_color, and the system icon does not follow the theme). Keep `theme_color` '#111827'.
   - `icons`, three entries, all `type: 'image/png'` with bare relative `src`:
     - `pwa-192x192.png`, 192x192, purpose 'any'
     - `pwa-512x512.png`, 512x512, purpose 'any'
     - `maskable-icon-512x512.png`, 512x512, purpose 'maskable'
   - Add `includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon-180x180.png']` so the non-manifest icons are precached too. This does not touch `globPatterns`; offline verification stays in UC07.
   - Leave `registerType` as is, leave `injectRegister` unset, and do not add `virtual:pwa-register`. Update the "Icons (and includeAssets) are added by…" comment.
5. **`index.html` (AC4, AC5).**
   - Links:
     - `rel="icon"` to favicon.svg, `type="image/svg+xml"`
     - `rel="icon"` to favicon-32x32.png, `sizes="32x32"`, `type="image/png"`
     - `rel="apple-touch-icon"` to apple-touch-icon-180x180.png, `sizes="180x180"`
   - Metas:
     - `mobile-web-app-capable` yes
     - `apple-mobile-web-app-capable` yes (both, to avoid Chrome's deprecation warning)
     - `apple-mobile-web-app-title` «Arco»
     - `apple-mobile-web-app-status-bar-style` `default` (reasoning above)
   - Keep the existing theme-color metas. Do not add a manual manifest link, because the plugin injects it.
   - **Path form.** Write the hrefs in source as public-root URLs ('/favicon.svg'). That is the Vite idiom: with `base: './'`, Vite rewrites them to './favicon.svg' in dist, the same mechanism that turns '/src/main.ts' into './assets/…'.
     - The developer MUST check dist/index.html after the build. Every icon/manifest href must be relative.
     - If Vite leaves any of them root-absolute, switch the source to './…' form instead. Vite will then log "didn't resolve at build time, will remain unchanged", which is acceptable.
6. **`playwright.config.ts` (AC5, real subpath).** Serve the preview under the real Pages subpath so 404s under `/arco-entrenamiento/` are caught.
   - Append `--base /arco-entrenamiento/` to the preview part of the webServer command only. The build keeps './'. The vite CLI accepts `--base` for preview.
   - Set `baseURL` and `webServer.url` to `http://localhost:4173/arco-entrenamiento/`, with the subpath as a single constant.
   - Existing specs use only relative gotos, so they should pass unchanged.
   - Fallback if preview cannot serve under the subpath: keep root serving, and AC5 then rests on the relative-path assertions in the new spec. Report it.
7. **`README.md`.**
   - Add an `npm run icons` row to the Scripts table.
   - Add a short "App icons" note: edit `public/favicon.svg`, run `npm run icons` (needs the one-time Chromium download), and commit the PNGs.
   - Optionally update "Status: scaffold only" — not required. **[Challenger: do NOT do this; scope creep]**
8. **`public/.gitkeep`.** May be removed now that the folder has files. Optional. **[Challenger: leave it]**

### Files Affected
**Production code** (developer):
- /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-06-instalar-en-movil/public/favicon.svg (new, source)
- the generated, committed PNGs in the same `public/` folder:
  - pwa-192x192.png
  - pwa-512x512.png
  - maskable-icon-512x512.png
  - apple-touch-icon-180x180.png
  - favicon-32x32.png
- …/scripts/generate-icons.ts (new). **Needs `scripts/**` added to `paths.production` by the orchestrator.** (Done.)
- …/vite.config.ts
- …/index.html
- …/package.json (the `icons` script only. Lockfile unchanged, no new deps)
- …/tsconfig.node.json
- …/playwright.config.ts
- …/README.md. **Not in `paths.production` today, so the orchestrator should add `README.md`.** (Done.)

**Test code** (qa):
- …/e2e/install.spec.ts (new), 375 px project, using a `trackConsole` guard like the one in scoring.spec. Tests:
  1. **Manifest.** The `link[rel=manifest]` href is relative (it does not start with '/' or a scheme) and its resolved URL returns 200 with valid JSON.
     - Fields: name, short_name, lang, display standalone, start_url and scope relative.
     - theme_color and background_color are '#111827'.
     - Icons include 192 'any', 512 'any' and 512 'maskable'.
  2. **Every icon.** This covers each manifest icon (resolved against the manifest URL) plus the apple-touch-icon and PNG favicon (from the DOM, resolved against the page URL).
     - The src/href is relative.
     - It returns 200 with content-type image/png.
     - The PNG signature is valid, and the IHDR width and height equal the declared `sizes`.
     - The SVG favicon returns 200 and image/svg+xml.
  3. **Artwork.** Load the PNGs into a canvas inside the page (same-origin, so not tainted).
     - The center pixel of the 512 any icon is about #FFE552, a pixel in the ring is about #F65058, and the corners are about #111827 with alpha 255. Check the apple-touch icon's corners as well.
     - In the maskable icon, every pixel outside radius 0.40×512, minus about 2 px anti-alias margin, is about #111827.
     - Use a small per-channel tolerance.
  4. **Service worker.** After goto './', wait for `navigator.serviceWorker.controller` to be non-null (clientsClaim, no reload needed). The registration scope ends with the served subpath.
  5. **Installability, the AC6 headline.**
     - Through a CDP session, `Page.getAppManifest` returns no errors.
     - `Page.getInstallabilityErrors` returns none, ignoring `in-incognito`.
     - If the headless shell lacks the check, run this spec with `test.use({ channel: 'chromium' })`. CI's `npx playwright install --with-deps chromium` already installs it.
     - If neither works, QA keeps checks 1–4 (the AC6 bullets the use case lists) and reports it.

### Risks & Considerations
- **Brief scope changes are needed before implementation.** `scripts/**` and `README.md` must be added to `paths.production`. (Done by the orchestrator.)
- **iOS.** iOS ignores the manifest icons, and that is why the apple-touch-icon and the metas exist. The apple-touch-icon is opaque edge to edge. Real install on a phone can't be automated. The user checks it by hand after deploy.
- **Relative paths.** There is no '/' in the manifest or in the dist HTML. This is enforced by the e2e checks and by serving the preview under `/arco-entrenamiento/`.
- **Vite rewriting public URLs.** The developer must verify it in dist (fallback in step 5).
- **Changing the Playwright base URL affects the whole suite.** It is low risk, because every goto is relative, but the full scoring spec must be re-run.
- **Status-bar style.** `default` over `black-translucent`, because the light-theme header is white.
- **Cross-platform PNG output.** PNGs are rasterized once on macOS and committed. CI never regenerates them, and the icon has no text. The tests use tolerances.
- **The 512 "any" and maskable icons differ only in scale.** That is intentional.
- **Theme.** The icon background is dark in both themes (use-case assumption accepted).
- **No notices.** No update or offline-ready prompts.
- **UC07 boundary.** No `globPatterns` or `navigateFallback` changes and no offline tests. `includeAssets` only adds the three non-manifest icons to the precache.
- **Dependencies (AC8).** No new deps, so `npm audit --omit=dev` is unchanged. A new e2e spec is the only test change. Unit coverage is unaffected.
- **Service worker and existing specs.** The existing scoring specs already ran with a SW registered, so precaching extra PNGs shouldn't change their behavior.
