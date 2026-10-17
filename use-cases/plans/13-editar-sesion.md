---
plan_for: use-cases/13-editar-sesion.md
work_branch: feat/uc-13-editar-sesion
run: arco-entrenamiento-uc-13
team: [analyst-uc13, challenger-uc13, developer-uc13, qa-uc13]
approved: 2026-10-17
---

UC13 (arco-entrenamiento-uc-13): analyst-uc13 proposal v1 is APPROVED in round 1, with three Minor notes below.

### Verdict
Approve.

### Strengths
- Every AC (1–12) maps to a step, and every pitfall is handled:
  - store guard when arrows exist;
  - legacy over-limit sessions;
  - unknown face;
  - no-op saves keep updatedAt;
  - push vs replace chosen deliberately.
- The rules are not duplicated. validateSessionForm is split into private helpers that both functions compose, its output does not change, and the existing tests stay untouched.
- The store's own guard is the second layer of defence:
  - with arrows, face and structure are ignored;
  - a structure triple that is not all positive integers is ignored;
  - ends are regenerated only when the structure really changes;
  - id, createdAt and closed are never touched.
- NewSessionView keeps the 'ns' id prefix and the RouterLink cancel, so its tests and the 20-control e2e count are preserved.
- The SummaryView test router gains the edit-session route, which avoids the console-guard trap.

### Issues Found
1. Minor: no `.hint` class exists in src. SessionForm must define it in its scoped CSS so the lock message wraps at 375 px.
2. Minor: SessionForm.test.ts should be mandatory, not optional. It should cover aria-describedby merging (hint + error id), the unknown-face option, and both cancel modes.
3. Minor: put hasAnyArrow in scoring.ts beside averagePerArrow. Do not refactor averagePerArrow.

### Recommendations
None beyond the three points above. No scope creep and no new dependencies.

---
FULL APPROVED PROPOSAL (verbatim from analyst-uc13, v1):

### Analysis
Worktree /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-13-editar-sesion (TARGET). Frontmatter: Vue 3.5 / Pinia / Router 4, paths.production src/**, e2e/** test, profiles []. Brief line 393 lists `updateSession(id, patch)`; it does not exist in src/stores/sessions.ts yet.
- Store (src/stores/sessions.ts): `SessionInput` is defined there and imported as a type by src/domain/sessionForm.ts:4. `emptyEnds(rows, arrows)` at :47. `createSession` validates nothing. `setClosed` (:142-147) is the idempotent pattern: no updatedAt bump on a no-op. A deep watch (:191-197) persists everything.
- Persisted invariants (src/domain/persistedState.ts:20-49): strings id/date/location/faceId/notes; distance is finite and ≥ 0 (non-integer legacy values are possible); seriesCount, endsPerSeries and arrowsPerEnd are positive integers; every archer has ends.length = series×ends and every end has length = arrows. An unknown faceId is still a valid persisted session. If an update breaks these invariants, the session is dropped on the next load, so the store must never write invalid structure.
- Backup merge (src/domain/backup.ts:86-108) replaces a session only when its updatedAt is strictly newer, so a no-op save must not bump updatedAt.
- Form domain (src/domain/sessionForm.ts): SessionFormValues uses raw strings; validateSessionForm (:120-163) checks date, distance, faceId (catalogue), 3 structure ranges (SESSION_LIMITS), and trims location and notes. MESSAGES are at :108-115.
- NewSessionView.vue: templates group, a form using ids `ns-*`, error ids `ns-<field>-error` through errorAttrs, `markCustom` on distance/Variable/face/structure input, «Crear» submit (disabled while invalid or already submitted), and a «Cancelar» RouterLink to `/`. It owns all form CSS (scoped). Pinned by src/views/NewSessionView.test.ts (label map at :217-234 with exactly 8 `label[for]`, 8 face options, `.checkbox`, `fieldset legend`, `button[type=submit]`) and by e2e/new-session.spec.ts:203-260, which counts exactly 20 controls under `.new-session`.
- SummaryView.vue: a `.summary-nav` 2-column grid with summary-back and summary-home RouterLinks. The heading is focused on mount. There is no notes block. Its unit test router (src/views/SummaryView.test.ts:34-45) has only `/`, scoring and summary, so a named link to `edit-session` would warn and trip the console guard. «is read-only: no buttons/inputs» (:303-314): links are OK. e2e/summary.spec.ts expectSummaryFits (:216-230) checks escapes, clipping, back/home ≥ 48 px, light/dark and a 0.1em wide-glyph pass. The worst-case seed is at :232.
- Router (src/router/index.ts): lazy named routes. App.vue keys RouterView by `$route.path`, so summary → edit → summary remounts and re-reads the store.
- vue-router web/hash history stores `state.back` = previous fullPath on push (node_modules/vue-router/dist/vue-router.mjs:145). Memory history only keeps the state passed to push (`router.push({ ..., state })`), so both branches can be unit-tested.
- The offline spec precaches every built asset, so a new lazy chunk needs no spec change.

### Proposed Solution
1. Domain, scoring: /src/domain/scoring.ts gets `hasAnyArrow(archers: readonly Archer[]): boolean`: true if any cell of any archer's ends is non-null. Store and view both use it as the single definition of «tiene flechas».

2. Domain, form: in /src/domain/sessionForm.ts:
   - `STRUCTURE_LOCKED_MESSAGE` = «La diana y la estructura no se pueden cambiar porque la sesión ya tiene flechas anotadas.»
   - `sessionToFormValues(session: Session): SessionFormValues`: date and location raw; variableDistance = distance === 0; distance '' when 0, else String(distance); faceId raw (even if unknown); the 3 structure fields as String(n); notes raw.
   - `validateSessionEdit(values, structureLocked: boolean): { errors: SessionFormErrors; patch: SessionPatch | null }`.
     - Unlocked: exactly validateSessionForm's errors, and patch = its input (all 8 fields). Legacy values over SESSION_LIMITS must be fixed before saving, as the use case requires.
     - Locked: only date and distance are validated (same messages). faceId and structure errors are never produced, so legacy over-limit or unknown-face sessions can still save place and notes. The patch then holds only date, location (trimmed), distance and notes (trimmed).
   - No duplicated rules: refactor validateSessionForm internally into private helpers (details: date + distance; structure: face + 3 ranges) that both functions compose. validateSessionForm's output must not change, and the existing sessionForm.test.ts must pass untouched. Update the file header comment (CU-01/02 + CU-11).

3. Store: in /src/stores/sessions.ts, `export type SessionPatch = Partial<SessionInput>` and `updateSession(id: string, patch: SessionPatch): void`, returned from the store.
   - Decision for AC5: when the session has arrows (hasAnyArrow), faceId, seriesCount, endsPerSeries and arrowsPerEnd are silently **ignored** and the other fields still apply. This is defence in depth; the view never sends them when locked.
   - A missing session is a no-op. `closed` does not matter: closed sessions are editable.
   - Each field applies only if present and valid:
     - date: string.
     - location: string, stored trimmed.
     - distance: finite and ≥ 0.
     - notes: string.
     - faceId: known to getTargetFace.
     - structure: the effective new triple (patch value ?? current) must be all positive integers, or the whole structure part is ignored.
   - A field counts as a change only if it differs from the stored value.
   - If the structure triple really changes (no arrows), set the 3 fields and replace each archer's `ends` with emptyEnds(series×ends, arrows). An unchanged structure never touches `ends`.
   - Bump updatedAt = Date.now() only if at least one field changed. Never touch id, createdAt, closed, archer ids, names or arrows.
   - Doc comment states these rules.

4. Shared form: new /src/components/SessionForm.vue. NewSessionView's `<form>` markup and all its form CSS move here unchanged: fields, labels, the «Estructura» fieldset, error paragraphs, Variable checkbox, actions and `.primary`/`.secondary`.
   - Model and props: `defineModel<SessionFormValues>('values', required)`; props `idPrefix: string`, `errors: SessionFormErrors`, `structureLocked?: boolean` (default false), `submitLabel: string`, `submitDisabled: boolean`, `cancelTo?: RouteLocationRaw`.
   - Emits: `submit`, `cancel`, `preset-edit`.
   - Ids become `${idPrefix}-date`, … and errors `${idPrefix}-${field}-error`. NewSessionView passes 'ns', so every existing id stays identical. Edit passes 'es'.
   - `preset-edit` fires where markCustom fires today: distance input, Variable change, face change, the 3 structure inputs. The «Variable blanks distance» logic moves into the component, so it behaves the same in both forms.
   - Cancel: when `cancelTo` is given, a RouterLink `.secondary` (NewSessionView, `/`, same as today). Otherwise a `<button type="button" class="secondary">Cancelar</button>` that emits `cancel`.
   - Locked mode (`structureLocked`):
     - The face select and the 3 structure inputs get `disabled`.
     - `<p id="${idPrefix}-structure-locked" class="hint" data-testid="structure-locked">` shows STRUCTURE_LOCKED_MESSAGE above the «Diana» field.
     - Each of those 4 controls gets `aria-describedby` with that id, plus the error id when one exists (attribute builder merges ids).
     - Add `select:disabled` to the existing `input:disabled` opacity rule.
   - Unknown face: if `values.faceId` is not empty and not in TARGET_FACES, render one extra first `<option :value="faceId">Diana desconocida</option>`. The select then shows something safe instead of a blank or a crash. The catalogue faces follow. Unlocked, the faceId error asks the user to pick one; locked, it is shown disabled and ignored. NewSessionView never hits this, so it keeps exactly 8 options.

5. NewSessionView: /src/views/NewSessionView.vue keeps the h2, the templates group and its CSS, values/validation/submitted/chooseTemplate/markCustom/create. It renders `<SessionForm v-model:values id-prefix="ns" :errors :submit-label="'Crear'" :submit-disabled="!validation.input || submitted" cancel-to="/" @submit="create" @preset-edit="markCustom">` inside `section.new-session`. No behaviour change. The 20-control e2e count and every NewSessionView test keep passing untouched.

6. Edit view: new /src/views/EditSessionView.vue, prop `id: string`.
   - Setup:
     - session = computed(store.getSession(id)).
     - values = ref(sessionToFormValues(session)), read once at setup, only when found.
     - locked = computed(hasAnyArrow(session.archers)).
     - validation = computed(validateSessionEdit(values, locked)).
     - `saving` ref guards double submit.
   - Template: `section.edit-session` with `<h2 ref tabindex="-1">Editar sesión</h2>`, focused onMounted (AC10, same as SummaryView). Then SessionForm with id-prefix 'es', submit «Guardar cambios», submit disabled while `!validation.patch || saving`, structure-locked = locked, no cancelTo. No templates.
   - Save: if patch, call store.updateSession(id, patch), then returnToSummary(). Persistence happens through the existing deep watch.
   - Cancel: returnToSummary() with no store call.
   - returnToSummary():
     - If `router.options.history.state.back` is a string that resolves to route `summary` with the same `id`, call `router.back()`. This is the normal flow (summary pushed edit), so the edit entry is popped. Browser Back from the refreshed summary then goes to scoring, never to a stale form, and the `?archer=` query is restored.
     - Otherwise (deep link or reload) call `router.replace({ name: 'summary', params: { id } })`.
     - Browser Back from the edit screen is native history, so it equals Cancel (AC7). No unsaved-changes prompt.
   - Not found: `section.not-found` «No se encontró la sesión.» + RouterLink «Volver al inicio» to `/`, no console output. An unknown face is NOT «not found» here: the form renders as in step 4.
   - CSS: `.edit-session h2 { margin-top: 0 }` only; the rest comes from SessionForm.

7. Route: /src/router/index.ts adds `{ path: '/session/:id/edit', name: 'edit-session', component: () => import('@/views/EditSessionView.vue'), props: true }`.

8. Summary:
   - /src/views/SummaryView.vue: in `.summary-nav`, add a third RouterLink «Editar datos» to `{ name: 'edit-session', params: { id } }`, data-testid `summary-edit`, `.nav-link` style. It spans both grid columns (`grid-column: 1 / -1`), so it is ≥ 48 px and full width without squeezing back/home. It shows for open and closed sessions.
   - Notes block after the zone distribution, only when `session.notes.trim() !== ''`: `<section aria-labelledby="summary-notes-title">` with `<h3 id=…>Notas</h3>` (same style as the distribution title) and `<p data-testid="summary-notes" class="summary-notes">` with the trimmed text. CSS: `white-space: pre-wrap; overflow-wrap: anywhere; margin: 0`. Plain interpolation, no v-html.

9. Home list: no change; SessionCard reads the store. Scoring: no change.

### Acceptance criteria coverage
| AC | Covered by |
|---|---|
| 1 | Step 8 link + step 7 route; fit in the summary e2e |
| 2 | Steps 2, 4, 6. Title «Editar sesión», no templates, shared fields/limits/validation |
| 3 | Steps 1, 4, 6 |
| 4 | Steps 2 and 6; the summary and home read the store |
| 5 | Step 3 (ignore policy) |
| 6 | Step 3 does not check closed and never touches it; scoring stays read-only because closed is unchanged |
| 7 | returnToSummary + native Back |
| 8 | Not-found branch |
| 9 | Step 8 notes block |
| 10 | Labels from SessionForm, ≥ 48 px through existing CSS, heading focus, fit tests |
| 11–12 | See Files Affected / Test |

### Files Affected
Production:
- New: src/components/SessionForm.vue, src/views/EditSessionView.vue.
- Modified: src/domain/sessionForm.ts, src/domain/scoring.ts, src/stores/sessions.ts, src/views/NewSessionView.vue, src/views/SummaryView.vue, src/router/index.ts.

Test:
- src/domain/scoring.test.ts: hasAnyArrow cases:
  - no archers / all null → false;
  - one cell in any archer → true, including an unknown key.
- src/domain/sessionForm.test.ts (additions only):
  - sessionToFormValues: normal, distance 0 → Variable, legacy over-limit, unknown face, multiline notes.
  - validateSessionEdit unlocked: same errors as validateSessionForm, full patch, trimmed.
  - validateSessionEdit locked:
    - over-limit structure and unknown face → no errors, patch has only the 4 detail fields;
    - an invalid date or distance still errors with a null patch.
- src/stores/sessions.test.ts, updateSession:
  - applies details and trims location;
  - no arrows + structure change → ends regenerated empty with the new size, for every archer (synthetic second archer);
  - face change without arrows;
  - with one arrow → face and structure ignored, details applied, ends identical (deep equal, same arrows);
  - a locked patch with only structure → no change and no updatedAt bump;
  - identical patch → updatedAt unchanged (fake timers);
  - real change → updatedAt = now;
  - id, createdAt and closed untouched;
  - closed session editable and still closed;
  - missing id → no-op (state deep-equal);
  - invalid structure (0, 1.5) or unknown face ignored;
  - persisted state after the update reloads through isSession (load in a fresh pinia).
- src/components/SessionForm.test.ts (new; mandatory per challenger note 2):
  - id prefix;
  - locked → 4 controls disabled with aria-describedby containing the hint id, and the hint text shown; aria-describedby merges hint + error id;
  - unlocked → no hint;
  - unknown-face option;
  - cancel button emits vs RouterLink.
- src/views/EditSessionView.test.ts (new). Router has `/`, summary, edit-session and scoring stubs; console warn/error spies.
  - Pre-fill for every field, including Variable checked for 0, and notes.
  - Title «Editar sesión» focused.
  - No `[aria-label="Plantillas"]` group.
  - Locked vs unlocked (seed with one arrow).
  - Errors as in new (e.g. 13 arrows unlocked → message + aria-describedby + «Guardar cambios» disabled + nothing saved).
  - Locked with over-limit legacy structure still saves place and notes.
  - Save calls the store and navigates. Two branches:
    - push summary, then edit with `state: { back: '/session/s1/summary?archer=a1' }` → back() lands on the summary with archer;
    - direct push → replace to summary.
  - Save without changes keeps updatedAt.
  - Cancel changes nothing (localStorage string identical) and navigates.
  - Closed session saves and stays closed.
  - Unknown id → message + home link.
  - Unknown face renders «Diana desconocida».
  - Route test: `edit-session` path, lazy, props true.
- src/views/SummaryView.test.ts:
  - add the `edit-session` stub route;
  - «Editar datos» href `/session/s1/edit` for open and closed;
  - notes block shown, trimmed and with line breaks preserved (text content contains '\n') for non-blank notes;
  - absent for '' and '   '.
- src/views/NewSessionView.test.ts: unchanged (must pass as-is).
- e2e/edit-session.spec.ts (new, 375×740, trackConsole must stay empty):
  1. Create from /new (Sala 18 m), «Resumen», «Editar datos». Change date, place, notes (2 lines) and «Flechas por tanda» 3→5. Save.
     - The summary shows the new date/place and the notes block with both lines.
     - page.goBack() lands on the scoring URL, whose first row has 5 cells.
     - The home card shows the new place.
     - Stored session has arrowsPerEnd 5 and ends rows of 5.
  2. Score one arrow → Resumen → Editar.
     - Diana and the 3 structure fields are disabled, with the hint text and aria-describedby.
     - Change the place and save → summary shows it; the stored ends keep the arrow.
  3. Finalize → (summary) Editar → change notes → save.
     - Summary shows «Finalizada» and the notes; stored closed true.
     - «Ver tabla» is locked («Reabrir sesión» present).
  4. Cancel after editing fields → summary unchanged, stored JSON identical.
  5. Fit:
     - edit screen in light/dark, locked and unlocked;
     - docOverflow and `.app-main` overflow ≤ 0;
     - every control in `.edit-session` (inputs, select, textarea, Variable label, buttons) ≥ 48 px and inside 375;
     - the hint wraps;
     - then a `.edit-session { letter-spacing: 0.1em }` pass.
- e2e/summary.spec.ts:
  - the worst-case seed gains a long multi-line note with a 60-char unbroken word;
  - expectSummaryFits also checks `summary-edit` as a touch target;
  - assert the «Editar datos» link and the notes block are visible in the worst case (light, dark, wide glyphs).
- Other e2e specs need no changes (new-session.spec keeps its 20-control count); offline.spec untouched.

### Risks & Considerations
- AC5 policy choice: ignore, not fail. Simpler for callers. Tested both ways: a locked patch never changes ends, and a structure-only locked patch does not bump updatedAt.
- Stored location/notes with leading or trailing whitespace: the form shows them raw and saves trimmed. That counts as a real change and bumps updatedAt. It is acceptable because the data does change.
- A legacy non-integer distance (e.g. 18.5) shows «18.5», and distance validation asks for whole metres before saving. Distance is always editable, so this never blocks.
- Unknown face plus no arrows: the user must pick a catalogue face to save (same rule as create). With arrows it is ignored. SummaryView still treats an unknown face as not found, so in practice the edit page is only reached by URL in that case.
- returnToSummary relies on `history.state.back`, which hash history sets. The fallback replace covers deep links and reloads. Forward after a save returns to a fresh edit form read from the store, which is harmless.
- Moving scoped CSS into SessionForm: the template buttons' CSS stays in NewSessionView; the h2 rule too. The e2e and unit tests on /new guard against regressions. Using defineModel with nested v-model mutates the parent's reactive object; this is intended and needs no `vue/no-mutating-props` exception.
- «Editar datos» adds about 56 px of height to the summary; the summary scrolls in .app-main, and the fit tests are extended.
- No new dependencies. UI in Spanish, code in English. Coverage of src/domain and src/composables stays ≥ 90 % thanks to the new tests.
