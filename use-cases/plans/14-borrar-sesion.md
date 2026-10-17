---
plan_for: use-cases/14-borrar-sesion.md
work_branch: feat/uc-14-borrar-sesion
run: arco-entrenamiento-uc-14
team: [analyst-uc14, challenger-uc14, developer-uc14, qa-uc14]
approved: 2026-10-17
---

UC14 (arco-entrenamiento-uc-14): challenger-uc14 approves analyst-uc14's proposal v1 with no Critical or Major issues. The full approved proposal follows.

### Verdict
Approve. I checked the analysis against the code. App.vue uses a plain <RouterView :key="$route.path"> with no transition, so navigating first and then deleting cannot flash the not-found screen. The deep-watch persistence and useConfirm's isConnected guard both exist as described. expectEditFits currently asserts 11 controls. Every AC (1 to 8) and every pitfall is covered, nothing is out of scope, and no new dependencies are added.

### Minor recommendations (non-blocking)
1. In the EditSessionView confirm test, use a router.afterEach to assert the session still existed when the route changed. That pins the navigate-then-delete order.
2. Keep the SessionsView focus hook minimal: no toast, and focus only when history.state.sessionDeleted is set.
3. The delete-session e2e should guard console errors across the confirm and navigation step.

---
## APPROVED PROPOSAL (analyst-uc14, v1, verbatim)

### Analysis
- Store /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-14-borrar-sesion/src/stores/sessions.ts has no deleteSession (brief line 393 lists it). Persistence is the deep watch on {version, sessions, profileName} (lines 267-273), so any mutation of `sessions` is saved; no explicit save needed (only importJson saves explicitly, to report failure).
- EditSessionView.vue (src/views) renders `<section v-if="session && values" class="edit-session">` with SessionForm, else the not-found section. `saving` guards double submit. returnToSummary pops/replaces.
- useConfirm (src/composables/useConfirm.ts) is a singleton; settle() resolves then refocuses `returnFocusTo` on nextTick only if `isConnected`. ConfirmDialog paints confirm red when danger (default true). Pattern to copy: ScoringView.vue lines 43-55 («¿Borrar la tanda?», confirmLabel «Borrar», returnFocusTo explicit for iOS).
- Date formatting: src/domain/dates.ts formatDisplayDate('YYYY-MM-DD') → 'DD/MM/YYYY'.
- Home (SessionsView.vue) does not focus anything on mount; h2 «Sesiones» at line 157; empty text «Todavía no hay sesiones de entrenamiento.» (line 164).
- Not-found branches already exist in ScoringView (line 158), SummaryView (line 131: session missing → «No se encontró la sesión.»), EditSessionView (line 72), each covered by existing "unknown id" tests with console guards.
- Existing test that WILL break: e2e/edit-session.spec.ts expectEditFits asserts `m.controls.length === 11` over every button/a/input… inside `.edit-session` (line ~277). Adding the delete button inside `.edit-session` makes it 12. Also EditSessionView.test.ts uses `button.secondary` for Cancel and `button[type="submit"]` for save, and its test routers declare `{ path: '/' }` without a name.
- Navigation history in the e2e flow: home → (new, replaced by) scoring → summary → edit; replacing edit with home leaves [home, scoring, summary, home], so Back lands on the deleted session's summary, which shows «No se encontró la sesión.» (accepted by the use case's assumption; we don't rewrite history).

### Proposed Solution
1. Store — src/stores/sessions.ts: add `deleteSession(id: string): void`, documented (CU-12): finds the index by id; missing id is a no-op; otherwise splices it out of `sessions.value` in place (keeps the other session objects untouched, identity preserved). Persisted by the existing deep watch. Export it in the returned object (place after updateSession). No change to backup/merge logic.
2. EditSessionView.vue:
   - Imports useConfirm and formatDisplayDate. New refs: `deleteButton` (HTMLButtonElement|null) and `deleting` (boolean).
   - New async `confirmDelete()`: returns if `!session.value || deleting.value || saving.value`; reads the date from the STORED session (`session.value.date`, not the unsaved form value) before awaiting; calls confirm({ title: '¿Borrar la sesión?', message: `Se eliminarán la sesión del ${formatDisplayDate(date)} y todas sus flechas. No se puede deshacer.`, confirmLabel: 'Borrar', cancelLabel: 'Cancelar', danger: true, returnFocusTo: deleteButton.value ?? undefined }). On false: return (useConfirm returns focus to the button; nothing changes). On true: set `deleting = true`, then `await router.replace({ name: 'sessions', state: { sessionDeleted: true } })`, THEN `store.deleteSession(props.id)`.
   - Order decision (pitfall 1): navigate first, delete second. The edit view unmounts while the session still exists, so its computeds never go undefined and the not-found branch never renders (not even one flush). The whole replace for the eager 'sessions' route resolves in microtasks, so the home card is removed before the browser paints. If the navigation were to fail, the session is still deleted after the await and the view falls back to the existing not-found branch — no crash. Unsaved form changes are never saved (deleteSession is called, updateSession is not), and validation is never consulted, so an invalid form still deletes.
   - Guards: save() also returns early when `deleting` is true; the SessionForm @cancel handler becomes a small wrapper that ignores cancel while deleting (prevents a stray tap on the form underneath the closing dialog from calling router.back() racing the replace). The delete button gets `:disabled="deleting"`. Double tap on «Borrar»: the first settle closes the dialog and nulls the resolver, so a second settle is harmless; the `deleting` flag blocks re-entry.
   - Template: after <SessionForm>, inside `.edit-session`, a separate `<section class="danger-zone" aria-label="Borrar sesión">` (or a div) with a top border (1px var(--color-border)) and margin-top var(--space-6)/padding-top var(--space-4), containing `<button ref="deleteButton" type="button" class="delete-session" data-testid="delete-session" @click="confirmDelete">Borrar sesión</button>`. The button is outside the <form>, so it can never submit it (type="button" anyway per AC). Class must NOT be `secondary`/`primary` (existing tests select `button.secondary`).
   - Style (scoped): full width, flex centred, min-height var(--touch-min), padding 0 var(--space-4), radius var(--radius), font inherit/600, touch-action manipulation, outlined danger like ScoreActions' «Borrar tanda» (src/components/ScoreActions.vue lines ~77-78): border 1px var(--color-danger), color var(--color-danger), background var(--color-surface); disabled opacity 0.5. Works in both themes since --color-danger is redefined in dark (tokens.css line 56). Shown for open and finalized sessions alike (no `closed` condition). NewSessionView is untouched (button not in shared SessionForm).
3. Home focus (pitfall 2): SessionsView.vue — h2 «Sesiones» gets `ref="heading"` and `tabindex="-1"`; onMounted focuses it only when `router.options.history.state.sessionDeleted === true` (same history.state mechanism EditSessionView already uses for `back`). Normal app launch keeps today's behaviour (no focus change), so existing tests are unaffected. The delete button's isConnected guard in useConfirm already prevents refocusing the removed button. No toast/notice (not requested).
4. Backup (AC6): no logic change; covered by tests only.

### Tests
- src/stores/sessions.test.ts — new `describe('deleteSession')`: removes the target (getSession undefined, length −1); unknown id no-op (sessions deep-equal, stored JSON unchanged); other sessions intact (deep-equal, same objects); persisted after flush (stored().sessions lacks it), also works for a closed session; after delete, exportJson no longer contains the id; importJson of a backup made before deletion previews/applies `added: 1` and the session is back.
- src/views/EditSessionView.test.ts — add `name: 'sessions'` to the stub '/' routes in view() (and the inline routers if touched); new `describe('EditSessionView delete')` mounting with ConfirmDialog attached (as SessionsView.test does at ~line 223, "SessionsView plus the dialog host"): button present with testid, type="button", text «Borrar sesión», outside the form, for open and closed sessions; click opens dialog with exact title, message «Se eliminarán la sesión del 17/10/2026 y todas sus flechas. No se puede deshacer.» (fixture date), labels «Borrar»/«Cancelar», confirm without `is-safe`; «Cancelar» and Escape: store/localStorage unchanged, route still edit, focus back on delete button; confirm: router.replace spied (called with name 'sessions'), no router.push, route '/', session gone from store and storage, updateSession not called even with edited (and invalid, e.g. date cleared) fields; double click on «Borrar» → one deleteSession and one replace, no console errors; window.confirm spy never called. Also an assertion that NewSessionView has no delete-session button (NewSessionView.test.ts, one line). Per challenger recommendation 1: a router.afterEach asserts the session still existed when the route changed.
- src/views/SessionsView.test.ts — heading focused when mounted after a push with state { sessionDeleted: true }; not focused on a plain mount.
- e2e/edit-session.spec.ts — expectEditFits count 11 → 12 and update the comment to include «Borrar sesión».
- New e2e/delete-session.spec.ts (own trackConsole helper like the other specs; console guards strict, including across the confirm and navigation step): (1) create two sessions; (2) second: Resumen → «Editar datos» → «Borrar sesión» → dialog texts → «Cancelar» → still on edit, button focused, two cards on home after Back/visit; (3) «Borrar sesión» → «Borrar» → URL home, one card, «Sesiones» heading focused; (4) reload → one card, storage has 1 session; (5) page.goBack() → «No se encontró la sesión.» (summary) and goto of /score/<archerId>, /summary, /edit of the deleted id each show the not-found text; (6) deleting the last one shows «Todavía no hay sesiones de entrenamiento.»; (7) finalized session can be deleted; (8) fit at 375 px light+dark+wide glyphs: button ≥ 48 px tall, inside viewport, no doc/main overflow; no native dialog ever (trackConsole's dialog handler). offline.spec untouched.

### Files Affected
Production: src/stores/sessions.ts, src/views/EditSessionView.vue, src/views/SessionsView.vue.
Test: src/stores/sessions.test.ts, src/views/EditSessionView.test.ts, src/views/SessionsView.test.ts, src/views/NewSessionView.test.ts, e2e/edit-session.spec.ts, e2e/delete-session.spec.ts (new).
(All paths under /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-14-borrar-sesion.)

### Risks & Considerations
- Navigate-then-delete relies on `await router.replace` resolving; if it rejects/fails the deletion still runs afterwards (deliberate), showing the existing not-found page — safe.
- history.state.sessionDeleted survives a reload of that home entry, so a reload refocuses the heading — harmless.
- A human double-tap might land its second tap on the home screen (already rendered); can't be guarded from the edit view; touch-action: manipulation on dialog buttons limits it.
- Back after delete reaches the stale summary entry → existing not-found screen (accepted assumption; no history rewrite).
- Coverage: only the store (not a gated path) and views change; domain/composables coverage unaffected.
- No new dependencies; UI strings Spanish, code English.
