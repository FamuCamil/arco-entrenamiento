---
plan_for: use-cases/01-anotar-flechas.md
work_branch: feat/uc-01-anotar-flechas
run: arco-entrenamiento-uc-1
approved: 2026-10-15
---

Challenger verdict for arco-entrenamiento-uc-1: APPROVED after 2 rounds. Below is the full approved proposal, v1 merged with the v2 changes.

Orchestrator note (R1): the user asked for an autonomous run; the field-face and 3D colour decisions below are adopted as proposed (X on the field face is physically inside the yellow 6 ring; M grey is consistent with every other face). The user was informed and may override later.

T = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-01-anotar-flechas (all paths absolute under T).

## Analysis
The worktree is the F0 scaffold:
- src/main.ts (createApp+Pinia+router)
- src/App.vue (header + RouterView, main with safe-area padding)
- src/router/index.ts (only "/", hash history)
- src/views/SessionsView.vue (placeholder)
- src/styles/tokens.css (zone colour vars, --touch-min 48px, --safe-* vars)
- empty src/domain, stores, composables, components, and e2e

vite.config.ts already has jsdom and coverage-v8 with 90% lines on src/domain/** and src/composables/**. playwright.config.ts uses testDir e2e, a 375x740 Pixel 5 project, and a webServer that builds and previews on 4173. Chromium is cached locally. deploy.yml uses checkout@v4, setup-node@v4, upload-pages-artifact@v3 and deploy-pages@v4. Pinia is 4.1.0 (setup stores). profiles: [] and the brief frontmatter is valid. UC01 is the foundation for UC02-05. Extension points are left in place, but none of their scope is implemented.

## Proposed Solution

### Domain (pure TS, no Vue/DOM imports)
1. **src/domain/types.ts (new):** the brief data model verbatim: End, ScoringZone {key, points, order, bg, fg}, TargetFace, TargetIcon, Archer {id, name, position A-D, ends}, Session (all brief fields), PersistedState {version: 1, sessions, profileName}, plus Cell {row, col}.
2. **src/domain/targetFaces.ts (new):** TARGET_FACES with the 8 brief faces (wa-122, wa-80, wa-80-6, wa-60, wa-40, wa-40-triple, wa-field, 3d), Spanish names and icons exactly as in the brief.
   - Zones are listed best-to-worst with order 0..n in the same sequence (the array order and the order field agree; UC04/UC05 rely on this). Points follow the brief (field X=6; 3D 11,10,8,5,M:0).
   - bg/fg are literal hex: X/10/9 #facc15, 8/7 #ef4444, 6/5 #3b82f6, 4/3 #111827, 2/1 #ffffff, M #d1d5db. fg is #111827 on yellow/white/grey and #ffffff on red/blue/black.
   - wa-field: 6/5 yellow, 4..1 black, plus the deviations X yellow (it is the inner 6 ring) and M grey (consistent with every other face).
   - 3D (the brief delegates this choice): 11/10 yellow, 8 red, 5 blue, M grey.
   - A comment cites the brief line and records the field and 3D colour decisions.
   - getTargetFace(id) returns undefined when the id is not found. Small builder helpers are allowed, but the exported data must be plain.
3. **src/domain/templates.ts (new):** SESSION_TEMPLATES with the 9 brief templates. UI labels exactly as in the brief (Sala 18 m … Personalizada), stable kebab ids, distance (0 for Campo/3D), faceId, seriesCount, endsPerSeries, arrowsPerEnd. For Personalizada the type makes "free" explicit (nullable preset or custom flag), with no fake numbers. getTemplate(id).
4. **src/domain/scoring.ts (new):** only this UC's functions.
   - zonePoints(key, face): 0 for null or an unknown key.
   - firstEmptyCell(ends): row-major first null; the last cell if none; {0,0} for an empty matrix.
   - nextCell(cell, ends): next arrow; wraps to the next row's first arrow; stays put at the last cell. This deliberately differs from the brief's nextCell(cell): the dimensions are derived from ends. Later UCs append to this file.
5. **src/domain/ids.ts (new):** createId() uses crypto.randomUUID, falls back to a v4-shaped id from crypto.getRandomValues, and last of all to Math.random + Date.now + a counter. It is accessed via globalThis.crypto so tests can stub it.
6. **src/domain/dates.ts (new):** localIsoDate(date = now) returns YYYY-MM-DD in local time. It must not use toISOString.

### Persistence and state
7. **src/composables/usePersistence.ts (new):** the only module that touches localStorage. STORAGE_KEY 'archery-training:v1'.
   - load() returns a valid PersistedState, or the empty state {version 1, sessions [], profileName ''} in any of these cases: storage unavailable, the window.localStorage access throws (it is inside the try), getItem throws, invalid JSON, or validation fails.
   - migrate(raw) is the migrations entry point. Version 1 passes; an unknown or missing version counts as corrupt.
   - The structural validator drops the whole state if anything is invalid.
   - Corrupt or unmigratable raw content is copied to the side key 'archery-training:v1:corrupt' before the empty state is returned. This follows the brief's trust-boundary rule.
   - save(state) uses try/catch and returns success or failure without throwing.
   - requestPersistentStorage() calls navigator.storage.persist() only if it exists, swallows rejections and never throws.
8. **src/stores/sessions.ts (new):** Pinia setup store useSessionsStore.
   - State: sessions and profileName, hydrated once from load() at store creation.
   - Getters: getSession(id) and getArcher(sessionId, archerId), both returning undefined when not found.
   - createSession(input) takes {date, location, distance, faceId, seriesCount, endsPerSeries, arrowsPerEnd, notes?}. It builds a Session with createId, closed false and createdAt/updatedAt = Date.now(). It adds exactly one Archer: name DEFAULT_ARCHER_NAME 'Yo' (CU-21 will swap in the profile name), position 'A', ends = seriesCount*endsPerSeries independent rows of arrowsPerEnd nulls. It returns the session.
   - setArrow(sessionId, archerId, row, arrow, key|null) is a no-op if the session or archer is missing, the session is closed, the row/arrow is out of range, or a non-null key is not on the face. Otherwise it writes the cell and bumps updatedAt. A one-line comment marks the UC04 sortEnd hook. null is accepted for UC03.
   - A deep watch on {version 1, sessions, profileName} calls save, with failures caught.
   - None of the later-UC actions (updateSession, deleteSession, setClosed, deleteEnd, export/import, sortedSessions) are added.
9. **src/composables/useScoring.ts (new):** useScoring(sessionId, archerId) returns:
   - session, archer and face (computed, undefined when not found)
   - selected (ref Cell, initialised to firstEmptyCell, or {0,0} when not found); it is never persisted
   - isLocked (computed from closed)
   - score(key): ignored when locked or not found; otherwise calls setArrow at selected, then sets selected = nextCell(selected, ends). At the last cell the selection stays put, so the next press overwrites it.
   - activeRowRef: the grid sets it to the active row's element on mount and whenever the active row changes. A watcher on the element itself calls el.scrollIntoView({block:'nearest'}), guarded for a missing method, each time it becomes a new non-null element. This covers the initial position on entry or reload and every row change. Moving within the same row does not re-scroll.
   - There is no select() (that is CU-04 / UC02) and no dead API.
10. **src/main.ts (modify):** after mount, call requestPersistentStorage() fire-and-forget (AC12).

### UI (Spanish strings, script setup lang ts, tokens only)
11. **src/router/index.ts (modify):** add the route /session/:id/score/:archerId, name 'scoring', lazy ScoringView, props: true. Update the comment.
12. **src/views/SessionsView.vue (modify):** add a «Sesión de prueba» button (≥48px, visible focus) inside a TODO(CU-01) block that covers the button, the TEST_SESSION_LOCATION constant ('Sesión de prueba') and the handler.
    - If a session with that location exists, navigate to scoring for its first archer.
    - Otherwise call createSession from the 'sala-18' template (wa-40, 2x10x3, 18 m) with date localIsoDate() and location 'Sesión de prueba', then navigate.
    - The data model gets no new fields. The existing heading and empty text stay.
13. **src/views/ScoringView.vue (new):** string props id and archerId; uses useScoring.
    - Not-found branch (session, archer or face missing): a Spanish message «No se encontró la sesión» and a RouterLink «Volver al inicio» to "/". It renders before any child gets undefined props, so there are no warnings.
    - Found branch: a header «A - Yo» built as position + ' - ' + name, then ScoreGrid, then either ScoreKeypad (open session) or a lock panel (aria-hidden lock icon + «Sesión finalizada — solo lectura») when the session is closed.
    - Layout: a flex column filling the space below the App header, with no second page scrollbar. The developer chooses the mechanism: either the App shell becomes a 100dvh flex column with main flex:1 and min-height:0 (without affecting SessionsView), or ScoringView gets an explicit height of 100dvh minus the header and padding.
    - The grid scroller is flex:1, min-height:0, overflow-y:auto. The keypad is flex:none, below the grid and not overlaying it, with safe-area padding. No horizontal scroll at 375px.
14. **src/components/ScoreGrid.vue (new):** props ends, endsPerSeries, selected, plus a callback or function ref that registers the active row element.
    - One block per series with the heading «Serie n», as a semantic table (one table or tbody per series).
    - One row per end shows the end number within its series (1..endsPerSeries) and one ScoreCell per arrow.
    - Columns are structured so UC05 can add totals without restructuring.
    - Test hooks: data-testid score-row-{row} and score-cell-{row}-{col}. The selected cell carries aria-current="true" (or aria-selected).
15. **src/components/ScoreCell.vue (new):** shows the key or nothing. The selected highlight is token-based with good contrast in both themes. The cell is not interactive in this UC: no button, no click handler, not focusable (AC21).
16. **src/components/ScoreKeypad.vue (new):** props face and disabled?; emits score(key).
    - Exactly face.zones, in catalog order (AC4).
    - Inline background/color from zone.bg/zone.fg (AC5), always with a 1px border.
    - Keys at least 48x48 (--touch-min), with bold labels of about 1.25rem or larger (red and blue with white text only pass contrast as large text).
    - aria-label in Spanish («Anotar X», «Anotar 10», «Anotar fallo» for M) and data-testid key-{key}.
    - The grid fits 12 keys at 375px (e.g. 6 columns) and handles 5 and 7 keys gracefully. Safe-area bottom is respected.
    - No ScoreActions.vue (that is UC03).
17. **src/styles/tokens.css (modify only if needed):** e.g. a selected-cell token for light and dark. Zone hex values are unchanged.

### CI
18. **.github/workflows/deploy.yml (modify):** bump every action to its current major. The developer verifies the majors live (e.g. gh api repos/actions/<name>/releases/latest). checkout and setup-node must be at least v5 (Node 24), upload-pages-artifact at least v4, and deploy-pages on its latest major. No other workflow changes (AC19).

## Files Affected

Production code (developer):
- src/domain/{types,targetFaces,templates,scoring,ids,dates}.ts (new)
- src/composables/{usePersistence,useScoring}.ts (new)
- src/stores/sessions.ts (new)
- src/components/{ScoreGrid,ScoreCell,ScoreKeypad}.vue (new)
- src/views/ScoringView.vue (new)
- src/views/SessionsView.vue, src/router/index.ts, src/main.ts (modify)
- src/App.vue (modify only if the shell-flex approach is chosen)
- src/styles/tokens.css (modify if needed)
- .github/workflows/deploy.yml (modify)
- Remove the .gitkeep files in src/domain, stores, composables and components. e2e/.gitkeep belongs to QA.

Test code (QA). Every store or composable test uses setActivePinia(createPinia()) and clears localStorage in beforeEach. Hydration tests seed storage before the store is created.
- src/domain/scoring.test.ts: zonePoints, including the mandatory cases X,9,M on wa-40 = 19; X,6 on wa-field = 12; 11,5 on 3d = 16; and 0 for null or an unknown key. firstEmptyCell: empty, gap, full. nextCell: mid-row, row wrap, last cell stays.
- src/domain/targetFaces.test.ts: 8 faces; every zone has all fields; order is strictly ascending and matches the array; wa-40 key order is X,10..1,M; field colours match the decision (6/5 and X #facc15, 4..1 #111827, M as decided).
- src/domain/templates.test.ts: 9 templates with the brief values; every faceId resolves.
- src/domain/ids.test.ts: all three paths, plus uniqueness.
- src/domain/dates.test.ts: near midnight and zero padding.
- src/composables/usePersistence.test.ts: round-trip, key and shape; missing storage, throwing getItem/setItem, invalid JSON, wrong version and bad shape all give the empty state, with the corrupt side key preserved; requestPersistentStorage with the API absent or rejecting.
- src/stores/sessions.test.ts: createSession shape (Yo/A, dimensions, independent rows); getters; setArrow writes and bumps updatedAt; no-ops (closed, out of range, invalid key, missing ids); persisted after a change (await flush); hydration.
- src/composables/useScoring.test.ts: initial selection (first empty cell, or last when full); advancing and wrapping; the last cell stays and overwrites; locked means no write and no move; not-found tolerance; scrollIntoView called on initial element registration and again on a row-element change (stubbed).
- Component tests, at least ScoreKeypad (AC4/AC5 order, colours, aria-label) and ScoringView not-found and closed-lock states with a console.warn/error spy asserting no warnings (Vite dev build).
- e2e/scoring.spec.ts at 375x740:
  - click «Sesión de prueba» and assert 2 series x 10 rows x 3 cells with the first cell selected
  - score a full end and check that the selection advances and wraps
  - reload and check that the values persist and the selection is on the first empty cell
  - a second click reuses the session
  - no horizontal overflow; the keypad is fully in the viewport
  - a seeded session whose first empty cell is deep in series 2 opens with that row in the viewport
  - not-found via /#/session/nope/score/nope and via a valid session with a bad archerId: message and link, with no console error/warning and no pageerror
  - a closed seeded session (addInitScript) shows the lock text and no keypad
- Verification also runs `npm run coverage` and reports line percentages for src/domain/** and src/composables/** (AC17 is met only by this run), plus lint, typecheck, test, test:e2e and build (AC20).

## Risks & Considerations
- **R1 — user confirmation needed:** the wa-field X is yellow and M is grey, a non-literal reading of the brief's "everything else black"; the 3D colours are 11/10 yellow, 8 red, 5 blue, M grey (the brief delegates this choice to this UC). If the user wants the literal reading, only the two field zone entries and their test assertions change.
- **AC13 lock:** can only be verified with seeded data. There is no close-session UI in F1, as the use case acknowledges.
- **Provisional «Sesión de prueba»:** wrapped in a TODO(CU-01) marker. Recognising it by its location string is fragile if a real session gets that name, which is acceptable while it is provisional.
- **Path overlap:** resolved by the orchestrator. The data-testid hooks are owned by the developer.
- **Contrast:** white on red or blue is about 3.7-3.8:1, so it only passes as large text; hence the bold labels of 1.25rem or larger.
- **Corrupt-storage side key:** goes slightly beyond AC11 but is required by the brief's trust boundary. Accepted.
- **Async persistence:** the watch-based save is asynchronous, so tests must await flush.
- **Layout:** if the height strategy goes wrong, you get nested scrollbars or a keypad below the fold. The e2e guards against this.
- **nextCell signature:** differs deliberately from the brief (extra ends argument).
- **AC19:** action majors must be checked live.
- **TargetIcon.vue:** excluded. No F1 acceptance criterion needs it; it arrives with the F2 session cards.
- **Coverage:** the fallbacks in usePersistence and ids need explicit tests to reach 90%.

## Challenger notes
- **Round 1:** 2 Major issues (field colours chosen silently; no scroll on entry) and 3 Minor (coverage run, height strategy, not-found console check). All were resolved in v2.
- **AC coverage:** every acceptance criterion 1-22 and all three pitfalls are mapped. No scope creep found.
