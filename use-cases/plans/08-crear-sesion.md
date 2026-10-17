---
plan_for: use-cases/08-crear-sesion.md
work_branch: feat/uc-08-crear-sesion
run: arco-entrenamiento-uc-8
approved: 2026-10-17
---

UC-08 (arco-entrenamiento-uc-8): challenger-uc8 approved this proposal in round 1. The full proposal from analyst-uc8 follows the verdict notes.

Orchestrator note: the user asked for an autonomous run. The ScoreGrid two-line wrap for more than 6 arrows (item 5) is accepted as necessary for AC11, AC13 and AC15(b), and the user is told in the run summary.

## Challenger verdict: Approve
- Every AC (1–16) and every pitfall is mapped.
- The ScoreGrid two-line wrap for arrowsPerEnd > 6 is justified by AC11, AC13 and AC15(b) plus the brief's no-horizontal-scroll NFR. It is gated so the ≤ 6 DOM stays byte-identical, and a seeded CI-font fit test protects it. It is not scope creep.
- The provisional list is minimal.
- The e2e adaptations keep what each spec verifies, including offline.spec under retries 0.
- No new dependencies.

Minor notes for the developer:
- (1) «132/132» in the 60 px wrapped total column is tight on DejaVu at 13 px. If it is within ~2 px, widen to 4rem (arrow columns stay ≥ 32 px).
- (2) Offline step 8b must use getByRole('heading', {name:'Nueva sesión'}), since the home button shares the name.
- (3) The wrapped tbody's active-row ref goes through the existing onActiveRow function ref.

---
# APPROVED PROPOSAL (verbatim from analyst-uc8, round 1)

### Analysis
TD = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-08-crear-sesion. Profiles: none (frontmatter `profiles: []`). Production = src/**, test = src/**/*.test.ts, tests/**, e2e/**.

Current state, checked in source:
- TD/src/views/SessionsView.vue:12-31 and :38-39 hold the «Sesión de prueba» block (TODO(CU-01)): it finds-or-creates a Sala 18 m session located «Sesión de prueba» and pushes `scoring`. Line 2 has TODO(CU-09). The empty text is always shown (line 37).
- TD/src/stores/sessions.ts: `createSession(input: SessionInput)` (43-69) returns the reactive session; no `sortedSessions` getter yet, although the brief's store spec lists one. SessionInput has `notes?`.
- TD/src/router/index.ts: only `/` and the lazy `/session/:id/score/:archerId` (name `scoring`, props). No `/new`.
- TD/src/domain/templates.ts: 9 templates, `personalizada` has `preset: null`; `getTemplate(id)`. TD/src/domain/targetFaces.ts: `TARGET_FACES` (8) and `getTargetFace`. TD/src/domain/dates.ts: `localIsoDate`.
- TD/src/composables/usePersistence.ts:39-55 `isSession` accepts any positive-int structure and ≥1 archer, so legacy sessions (incl. «Sesión de prueba») keep loading; no migration (AC14).
- TD/src/composables/useScoring.ts:17 starts on `firstEmptyCell`, so a new session opens on (0,0) (AC11).
- TD/src/App.vue:13 keys RouterView by path, so `/new` remounts fresh each visit.
- TD/vite.config.ts:21 precaches `**/*.{js,css,html}`, so a lazy NewSessionView chunk is precached automatically; e2e/offline.spec.ts:76-111 already asserts every built js/css is precached.
- e2e uses of «Sesión de prueba»: scoring.spec.ts:29-33 (`openTestSession`, used by 9 tests), :132-145 (reopen test), :389 and :398 (home marker after not-found / corrupt storage); offline.spec.ts:122, :139, :191, :218; install.spec.ts:115 (beforeEach marker); installability.spec.ts:28 (marker).
- IMPORTANT gap found: TD/src/components/ScoreGrid.vue is sized for at most 6 arrows (style comment :136, fixed cols 1.875rem + 3.375rem + 2.875rem = 130 px; e2e `expectGridFits` at scoring.spec.ts:701-745 requires no header/total overflow and cell buttons ≥32 px wide). With 12 arrows per end (allowed by CU-02 and AC9, and exercised by AC15's custom e2e), arrow columns drop to (343-130)/12 ≈ 17.75 px: headers «10»–«12» and score «10»/«11» overflow, buttons are < 24 px wide (below WCAG 2.2 target minimum), and «120/120» / «132/132» end totals (7 chars) overflow the 54 px total column on CI's wider Linux fonts (the run-05 failure mode). AC11 («la estructura … coincide») and the brief's no-horizontal-scroll NFR cannot be met for 7–12 arrows without a ScoreGrid change. I propose a contained one below (item 5) and flag it in Risks.

### Proposed Solution

**1. NEW TD/src/domain/sessionForm.ts (developer) — pure, no Vue imports**
- Constants: `DEFAULT_TEMPLATE_ID = 'sala-18'`, `CUSTOM_TEMPLATE_ID = 'personalizada'`, and `SESSION_LIMITS` = series 1–20, ends per series 1–30, arrows per end 1–12, distance integer ≥ 0 with no upper bound. Comment documents the caps (Pitfall 1): templates use at most 2×12; 20×30×12 = 7200 cells is the largest grid we accept, and a typo like 100×100 is rejected. The caps apply only to the form; usePersistence stays as is (AC14).
- Type `SessionFormValues`: `date`, `location`, `variableDistance` (boolean), `distance`, `faceId`, `seriesCount`, `endsPerSeries`, `arrowsPerEnd`, `notes`. All numeric fields are raw strings exactly as typed. That is how the empty iPhone input stays distinct from 0 (Pitfall 3). Type `SessionFormField` = union of the field names validated; `SessionFormErrors` = partial record field → Spanish message.
- `initialFormValues(today: string)`: the Sala 18 m preset applied to an empty form (18, wa-40, '2','10','3', variableDistance false), date = `today`, location and notes ''. The view passes `localIsoDate()` (Pitfall 2). Taking `today` as a parameter keeps it pure and testable.
- `applyTemplate(values, template)`: preset non-null → returns a new object with distance/variableDistance (distance 0 → variableDistance true and distance ''; otherwise false and String(distance)), faceId and the three structure fields from the preset; date, location and notes copied unchanged (AC5). Preset null («Personalizada») → returns an unchanged copy (AC6).
- `validateSessionForm(values)` → `{ errors: SessionFormErrors, input: SessionInput | null }`; `input` is non-null only when `errors` is empty. Rules (AC9):
  - date: matches YYYY-MM-DD and is a real calendar day (round-trip through Date.UTC, so 2026-02-30 is rejected; no local-time parsing). Message «Fecha no válida».
  - distance: if variableDistance → 0 and the text is ignored. Otherwise trimmed text must be all digits (`^\d+$`), so '' / '1.5' / '-3' / 'abc' are invalid, while '0' is valid and means Variable (AC8). Message «Indica los metros o marca «Variable»».
  - seriesCount / endsPerSeries / arrowsPerEnd: trimmed all-digits, integer within the limits. Messages «Entre 1 y 20 series», «Entre 1 y 30 tandas por serie», «Entre 1 y 12 flechas» (the AC10 example verbatim). Leading zeros ('03') are accepted as 3.
  - faceId: must resolve via `getTargetFace`. Message «Elige una diana del catálogo».
  - location and notes: always valid; `input` carries them trimmed.
  - Messages built from SESSION_LIMITS so caps and texts can't drift.

**2. TD/src/domain/dates.ts (developer)** — add `formatDisplayDate(iso)`: 'YYYY-MM-DD' → 'DD/MM/YYYY' by string split, no Date parsing (no TZ shift); returns the input unchanged if it doesn't match. Used by the provisional list; CU-09 can reuse it.

**3. TD/src/stores/sessions.ts (developer)** — add getter `sortedSessions` (computed, exported in the return) = a copy of `sessions` sorted by `date` descending (plain string comparison, valid for ISO dates, no locale), ties by `createdAt` descending (AC2). It must not reorder the underlying array (persisted order unchanged). This is the brief's named getter (Architecture > Store). `createSession` unchanged.

**4. TD/src/router/index.ts (developer)** — add `{ path: '/new', name: 'new-session', component: () => import('@/views/NewSessionView.vue') }`, lazy like ScoringView. Update the comment on line 5 (remaining routes no longer include /new).

**5. TD/src/components/ScoreGrid.vue (developer) — two-line ends when arrowsPerEnd > 6**
- `lineLength` = arrowsPerEnd when ≤ 6, else ceil(arrowsPerEnd / 2) (so 7–12 arrows → 4–6 per line). `wrapped` = arrowsPerEnd > 6.
- Not wrapped (every template, every session today): DOM, classes and test ids exactly as now. Existing ScoreGrid tests and every e2e fit test stay untouched.
- Wrapped: the colgroup has lineLength arrow columns. thead has two rows: row 1 = «T.» (rowspan 2), 1..lineLength, «Total» and «Acum.» (rowspan 2); row 2 = lineLength+1..arrowsPerEnd, plus one empty th when the count is odd. Each end becomes its own `<tbody>` carrying `data-testid="score-row-N"` and the active-row ref (scrollIntoView nearest then covers both lines). Line 1 has the row-number th (rowspan 2), cells 0..lineLength-1, end total and running total (both rowspan 2). Line 2 has the remaining cells plus one empty filler td when odd. `score-cell-R-C`, `end-total-R`, `running-total-R` test ids and cell aria-labels («… flecha 7: …») are unchanged. tfoot colspan = lineLength + 3. A table with several tbodies is valid HTML.
- Wrapped CSS only: total column widened to 3.75rem (60 px) to hold «132/132» (3D, 12 × 11) on wide fallback fonts. Arrow columns are then (343 − 30 − 60 − 46) / 6 ≈ 34.5 px, keeping buttons ≥ 32 px wide like today's 6-arrow worst case. Also a slightly stronger top border per end tbody so the two lines read as one end. Update the :136 comment.
- No change in useScoring or nextCell: the selection still walks col 0..n-1 and then the next row; only the drawing wraps.

**6. NEW TD/src/views/NewSessionView.vue (developer)**
- Script: `values` ref from `initialFormValues(localIsoDate())`; `selectedTemplateId` ref = DEFAULT_TEMPLATE_ID; `validation` computed from `validateSessionForm(values)`; a `submitted` flag.
- Template tap → `values = applyTemplate(values, template)` and `selectedTemplateId = template.id`.
- Edit rule (AC6): an @input/@change on any preset-controlled control (distance, Variable checkbox, diana, series, tandas, flechas) sets `selectedTemplateId = CUSTOM_TEMPLATE_ID`. The pressed state then tells the truth («Sala 18 m» isn't shown pressed for 2×10×6), and there is no watcher, so a template is never re-applied by itself; only an explicit tap applies one. Date, lugar and notas don't change the selection.
- Create: if `validation.input` is null or `submitted` → return. Otherwise set `submitted`, call `store.createSession(input)` exactly once (via the store object, not destructured, so a vi.spyOn works), then `router.replace({ name: 'scoring', params: { id, archerId: session.archers[0].id } })`. Replace, so Back from scoring goes home, not to a stale form that could create a duplicate (AC11).
- Template (Spanish UI):
  - h2 «Nueva sesión».
  - `role="group"` aria-label «Plantillas» with one `<button type="button">` per SESSION_TEMPLATES entry (label text, `:aria-pressed`) (AC3).
  - `<form novalidate @submit.prevent>` with, each with a visible `<label for>`:
    - «Fecha»: input type=date.
    - «Lugar (opcional)»: input type=text.
    - «Distancia (m)»: input type=text inputmode=numeric pattern=[0-9]*, disabled and blank while «Variable» is checked. Next to it, a checkbox «Variable» wrapped in a label with min-height 48 px (AC8).
    - «Diana»: native select over TARGET_FACES by `name` (AC7).
    - A fieldset legend «Estructura» with «Series», «Tandas por serie», «Flechas por tanda»: inputmode=numeric text inputs.
    - «Notas (opcional)»: textarea.
  - Each validated field renders its error `<p id="ns-<field>-error">` right after the control only when present. The control gets `aria-invalid="true"` and `aria-describedby` pointing to it (AC10). Static ids are fine: one instance per page.
  - Actions: «Crear» = `<button type="submit">` with native `disabled` when invalid (no focus-return need here, unlike ScoreActions), primary accent style like the old .test-session. «Cancelar» = RouterLink to `/` styled as a ≥48 px secondary button (AC12).
- Layout, robust to CI's wider fonts: a single column for all fields (no side-by-side structure inputs). Templates in a `grid-template-columns: repeat(2, minmax(0, 1fr))` grid, buttons with min-height var(--touch-min), wrapping labels («Aire libre 50 m compuesto» goes to 2 lines), `overflow-wrap: anywhere`. Inputs, select and textarea: width 100%, min-width 0, min-height 48 px, font: inherit (16 px also stops iOS zoom-on-focus), `display: block` for the date input (iOS intrinsic width). Pressed template: accent border + selected-bg tokens from tokens.css. Errors in --color-danger. No new tokens needed (AC13).

**7. TD/src/views/SessionsView.vue (developer)**
- Delete the whole TODO(CU-01) block, button, `.test-session` style and the `localIsoDate`/`getTemplate` imports (AC1).
- Add a `<button type="button">` «Nueva sesión» → `router.push({ name: 'new-session' })`. A button, as AC1 says, so the e2e marker stays `getByRole('button', …)`.
- Provisional list with a `TODO(CU-09)` comment replacing line 2's (provisional list; CU-09 replaces it with cards, plus export/import CU-15). `<ul aria-label="Sesiones guardadas">` over `store.sortedSessions`. Each `<li>` holds a RouterLink to `{ name: 'scoring', params: { id, archerId: archers[0].id } }`, rendered only when archers[0] exists (defensive). Text: `formatDisplayDate(date)` + « · » + (location.trim() or «Sin lugar»). The empty text shows only when there are no sessions (AC2). Rows are block links with min-height 48 px and overflow-wrap anywhere, kept minimal (no cards, no totals, no icon) per Pitfall 4.
- Legacy «Sesión de prueba» sessions appear as ordinary rows (AC14).

### Files Affected
- **Production code (developer):**
  - TD/src/domain/sessionForm.ts (new)
  - TD/src/domain/dates.ts
  - TD/src/stores/sessions.ts
  - TD/src/router/index.ts
  - TD/src/components/ScoreGrid.vue
  - TD/src/views/NewSessionView.vue (new)
  - TD/src/views/SessionsView.vue
- **Test code (qa):**
  - TD/src/domain/sessionForm.test.ts (new):
    - initialFormValues: sala-18 values and the given date.
    - applyTemplate for a fixed-distance preset and for Campo/3D (variableDistance true). Keeps date/location/notes. Personalizada returns equal values and a new object.
    - Boundaries: arrows 0/1/12/13, series 0/1/20/21, ends 0/1/30/31.
    - Rejects '', '  ', '1.5', '-1', 'abc'; accepts '03'.
    - distance '' invalid unless variable, '0' valid → 0, variable ignores garbage text.
    - Dates: '', '2026-1-1', '2026-02-30', '2026-13-01' invalid; '2024-02-29' valid.
    - Unknown faceId invalid.
    - Trimming of location/notes; `input` null iff errors; `input` matches SessionInput for a valid form.
    - Messages match the limits.
  - TD/src/domain/dates.test.ts: formatDisplayDate cases.
  - TD/src/domain/templates.test.ts:53: rename the «test-session template» description only.
  - TD/src/stores/sessions.test.ts: sortedSessions (date desc, createdAt desc on equal dates, reacts to createSession, does not mutate `sessions` order). The INPUT location string at :11 can stay.
  - TD/src/components/ScoreGrid.test.ts:
    - 12 arrows: two header rows 1–6 / 7–12, one tbody per end with score-row-N and 2 trs of 6 cells, rowspans on T./Total/Acum., colspan 9, cells 0..11 in order, the active tbody registered.
    - 7 arrows: 4 + 3 + a filler.
    - Existing ≤ 6 tests unchanged.
  - TD/src/views/SessionsView.test.ts: rewrite. No «Sesión de prueba»; «Nueva sesión» → `/new`; empty text; order; «Sin lugar» (also for whitespace-only); tap row → scoring with first archer; a legacy «Sesión de prueba» row listed. The router gets a `/new` stub route.
  - TD/src/views/NewSessionView.test.ts (new), with a console warn/error guard like ScoringView.test.ts:
    - 9 template buttons with aria-pressed, sala-18 pressed and its values, today's date, empty location/notes.
    - Aire libre 70 m overwrites and keeps typed date/location/notes.
    - Campo → Variable checked.
    - Personalizada keeps values.
    - Editing arrows after a template keeps the edit and presses Personalizada, and re-tapping a template re-applies it.
    - The select has 8 options by name.
    - 13 arrows → Crear disabled, «Entre 1 y 12 flechas» linked via aria-describedby and aria-invalid; fixing it clears both.
    - Create → createSession spy called once with trimmed input → route `scoring` with the new ids; a double submit still creates one.
    - Cancelar → `/`.
  - TD/e2e/new-session.spec.ts (new, 375 px, trackConsole):
    - (a) Template flow, AC15. «Nueva sesión» → #/new → «Aire libre 70 m» → «Crear» → scoring URL. 2 tables, 6 rows each, 6 cells per row. Selected (0,0). Keypad = X,10..1,M. Stored faceId 'wa-122' (WA 122's keys equal WA 40's, so the face is proven via storage plus «TOTAL GENERAL: 0/720»). Anotar X → goto './' → the row («DD/MM/YYYY · Sin lugar», today taken from page.evaluate) → same URL with the X → reload keeps it.
    - (b) Custom: «Personalizada», series 1, tandas 2, flechas 12, select «WA Campo» → Crear. 1 table, cells score-cell-0-0..0-11 and 1-0..1-11, keypad X,6,5,4,3,2,1,M, «TOTAL GENERAL: 0/144», selected (0,0), no doc overflow.
    - (c) Validation: flechas 13 → Crear disabled, «Entre 1 y 12 flechas» visible and referenced by the input's aria-describedby; set 12 → enabled.
    - (d) /new fits 375 px: no doc/body overflow; every button/input/select/textarea/checkbox label ≥ 48 px tall and inside the viewport width; Cancelar returns home without creating anything (storage empty).
  - TD/e2e/scoring.spec.ts:
    - `openTestSession` → `createDefaultSession`: goto './', click «Nueva sesión», expect #/new, click «Crear», expect the scoring URL. The default is the same WA 40 2×10×3 as the old test session, so all 9 callers keep their assertions verbatim.
    - The :132 test becomes «reopening from the home list returns to the same session» (same checks: same URL, cell 10, 1 stored session).
    - :389 and :398 markers → button «Nueva sesión».
    - New seeded fit test: 3D 1×2×12 all '11' → «132/132», «264», expectGridFits passes (min button width ≥ 32). Scoring 6 arrows into an empty 12-arrow end moves the selection to (r,6) on line 2.
  - TD/e2e/offline.spec.ts (retries 0 stays):
    - :122 marker → «Nueva sesión».
    - :139 → click «Nueva sesión», expect the «Nueva sesión» heading, click «Crear», same URL expectation. Steps 3–7 are then byte-identical in what they assert.
    - :191 marker → «Nueva sesión».
    - New step 8b: in the reopened offline page, click «Nueva sesión» and expect the form heading. This proves the lazy NewSessionView chunk is served from the precache in a fresh page.
    - :218 → same two-click flow.
    - Step 9's text regex does not match any new UI text (checked: «Variable», «Sin lugar», labels).
  - TD/e2e/install.spec.ts:115 and TD/e2e/installability.spec.ts:28: marker → button «Nueva sesión».

### Risks & Considerations
- **ScoreGrid change (item 5) is outside the literal summary.** Without it, 7–12-arrow sessions, which AC9/CU-02 allow and AC15(b) creates, render broken on the scoring screen. It is scoped to arrowsPerEnd > 6, leaving the CU-03..07 DOM byte-identical for ≤ 6. Alternatives rejected:
  - Shrinking fonts in one line: ~18 px targets, below the WCAG 24 px minimum, and fragile on CI fonts.
  - Horizontal scroll inside the grid: violates the brief's no-horizontal-scroll NFR.
  - Capping arrows at 6: contradicts the brief's 1–12.
  If you or the team lead prefer to defer it, AC15(b) would have to stop asserting layout, and the user should be told 12-arrow sessions look broken until then.
- **Caps (Pitfall 1):** 20 series, 30 ends per series, 12 arrows, as the use case suggests. They are enforced in the form only, not in persistence/import, so legacy data is unaffected (AC14). CU-15 import can decide separately.
- **Distance:** no upper bound (only integer ≥ 0, as AC9 says). Typed '0' is accepted and equals Variable, consistent with AC8. Checking «Variable» blanks and disables the input; unchecking requires typing a value (empty → error).
- **Numeric inputs** are type=text inputmode=numeric with pattern, not type=number, per AC13 and Pitfall 3. Raw strings avoid iOS's ''/NaN ambiguity. `novalidate` stops native bubbles.
- **Selection after edit** switches to «Personalizada». This is my reading of AC6 (the edit is respected; the pressed state stays truthful). The template is never stored (Pitfall 6, no `templateId`).
- **router.replace after Crear:** avoids returning to the form via Back. AC11 only requires the navigation.
- **Display date DD/MM/YYYY:** chosen for a Spanish UI. The AC only says «la fecha». Trivial to drop to the raw ISO date if you object.
- **CI fonts:** the form is single-column with wrapping template labels; the wrapped-grid total column is sized for «132/132». Both are asserted by e2e at 375 px so CI catches regressions.
- **offline.spec** gains one offline navigation (8b). It is deterministic under SW control, but it is extra surface in a retries-0 file. Drop it if you think the precache assertion at :76-111 is enough.
- Coverage: sessionForm.ts and formatDisplayDate are fully unit-tested, so src/domain stays ≥ 90 %. No new dependencies.
- Out of scope, respected: cards/TargetIcon (CU-09), edit/delete (CU-11/12), close/reopen (CU-10), archer name (CU-21). The store's createSession and usePersistence stay as they are.
