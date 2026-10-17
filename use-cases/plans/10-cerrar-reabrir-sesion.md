---
plan_for: use-cases/10-cerrar-reabrir-sesion.md
work_branch: feat/uc-10-cerrar-reabrir-sesion
run: arco-entrenamiento-uc-10
approved: 2026-10-17
---

UC-10 (arco-entrenamiento-uc-10): challenger-uc10 approved analyst-uc10's proposal v1 in round 1, with no Critical or Major issues. The verdict comes first, then the full approved proposal.

## Verdict: APPROVED
### Strengths
- AC1–AC10 are all covered. The analyst's code claims check out against the source: the setArrow/deleteEnd closed guards, isLocked, deep-watch persistence, `closed: false` saved since F1, and ScoreCell's aria-current ignoring `interactive`.
- The focus handling is correct. settle()'s returnFocus nextTick runs before the view's own nextTick. By then the «Finalizar sesión» button is disconnected, so the isConnected guard skips it, and the explicit reopenButton.focus() lands last.
- Reopen uses firstEmptyCell, with the last cell when the session is full. AC6 is untouched. The card indicator is a span inside the single RouterLink, so there are no nested controls. The CU-09 worst case is re-measured closed. The `danger` option defaults to true, so CU-03 is unchanged. No new dependencies and no scope creep.
### Issues Found (all Minor; the developer and QA handle them during implementation)
1. src/views/ScoringView.test.ts:457-470 also asserts `findAll('button')).toHaveLength(0)` on a closed session. It needs updating for «Reabrir sesión», which makes it 1, or the check should be scoped to cell buttons.
2. useConfirm.test.ts:29 checks `state.value` with an exact `toEqual`, so it must add `danger: true`.
3. Lock svg vs. existing svg locators: e2e/session-list.spec.ts:156/161 (strict `card.locator('svg')`) and SessionCard.test.ts:232 (`find('svg')` false). Keep those fixtures open and seed only «worst» closed, or scope them to `svg.card-icon`.
### Recommendations
- If any test asserts the worst card's full aria-label, update it to end with «, finalizada».

---
## APPROVED PROPOSAL (analyst-uc10, v1)

### Analysis
- The read-only behaviour already exists. The store's setArrow and deleteEnd return early on `session.closed` (src/stores/sessions.ts:87,107). useScoring derives `isLocked` from `closed`, and select, score, canDelete* and deleteArrow/End all no-op while locked (src/composables/useScoring.ts:19-70). ScoringView swaps `.controls` (keypad + ScoreActions) for a `.locked` role="status" block and passes `:interactive="!isLocked"` to the grid (src/views/ScoringView.vue:64-99). What's missing: a store action to flip `closed`, the two buttons, the card indicator, and hiding the selection while locked.
- Persistence is automatic. The store's deep watch saves on any mutation (sessions.ts:116-122), so setClosed only has to mutate. F1 already writes `closed: false` (sessions.ts:69), so no migration is needed (AC9).
- Gap against AC4: today a closed session still shows a selected cell. ScoreCell sets `is-selected` and `aria-current` from `selected` whether or not it is interactive (src/components/ScoreCell.vue:18-19). Three existing tests assert that, so they must change: src/components/ScoreGrid.test.ts:120-127, src/views/ScoringView.test.ts:184-196, and e2e/scoring.spec.ts:345-357.
- Focus pitfall on confirm. useConfirm.settle sets `pending=null`, resolves, then focuses `returnFocusTo` on a nextTick. The «Finalizar sesión» button unmounts in the same flush, so the view must move focus explicitly after the lock renders. On cancel, returnFocusTo is still needed for iOS taps, as with «Borrar tanda» (ScoringView.vue:42-47).
- ConfirmDialog always paints the confirm button in danger red (src/components/ConfirmDialog.vue:150-154). Finalizing can be reopened, so it isn't destructive.
- Layout: Playwright runs at 375×740. `.grid-scroller` is `flex:1; min-height:0`, so the extra 48 px row shrinks the grid instead of pushing the keypad off-screen. The activeRowRef scrollIntoView watch keeps the active row visible.

### Proposed Solution
1. **Store** (src/stores/sessions.ts): `setClosed(sessionId, closed)`, exported. It returns early when the session is missing or `session.closed === closed`, so updatedAt doesn't change. Otherwise it sets `closed` and `updatedAt = Date.now()`. Doc comment: idempotent. Nothing calls it on the last arrow (AC6).
2. **useScoring**:
   - `closeSession()` calls store.setClosed(id, true).
   - `reopenSession()` calls store.setClosed(id, false), then sets `selected.value = firstEmptyCell(archer.value.ends)`, guarded by `archer.value`. firstEmptyCell falls back to the last cell when the session is full.
   - Both are returned. Confirmation stays the caller's job.
3. **ScoreCell.vue**: `is-selected` and `aria-current` apply only when `selected && interactive`. Update the `interactive` prop comment.
4. **New src/components/LockIcon.vue**: the lock svg extracted from ScoringView.vue:82-87. It's decorative, aria-hidden, uses currentColor and is sized by a consumer class. ScoringView and SessionCard both use it.
5. **useConfirm / ConfirmDialog**: optional `danger?: boolean` in ConfirmOptions, default true, carried on ConfirmRequest. With `danger: false` the confirm button uses accent colours (border and background `--color-accent`, text `--color-accent-contrast`).
6. **ScoringView.vue**:
   - **Open state.** Inside `.controls`, after ScoreActions, a full-width `<button type="button">` «Finalizar sesión» with `data-testid="close-session"` and ref `closeButton`. Outlined accent style: `min-height: var(--touch-min)`, border and text `--color-accent`, background `--color-surface`, weight 600, `touch-action: manipulation`, small top margin. It's not in the «Acciones de borrado» group.
   - **Finalize handler.** `confirmClose()` calls confirm with title «¿Finalizar la sesión?», message «La sesión quedará en solo lectura. Podrás reabrirla cuando quieras.», confirmLabel «Finalizar» (cancel defaults to «Cancelar»), `danger: false` and `returnFocusTo: closeButton`. On true it calls closeSession(), awaits nextTick(), then focuses reopenButton. On false nothing changes.
   - **Locked state.** A `.locked-panel` wrapper (flex column, gap `--space-2`) holds the unchanged `.locked` role="status" div, now using LockIcon, and below it a sibling `<button>` «Reabrir sesión» with `data-testid="reopen-session"`, ref `reopenButton`, full width, min 48 px, filled accent like «Nueva sesión». The button sits outside role="status".
   - **Reopen handler.** `onReopen()` calls reopenSession(), awaits nextTick(), then focuses `.score-cell[aria-current="true"] .cell-button` in the section root, falling back to the first keypad key.
7. **SessionCard.vue**:
   - `isClosed = computed(() => props.session.closed)`.
   - When closed, an extra line after the totals: `<span class="card-line card-meta card-status" data-testid="card-status">` with LockIcon (class card-status-icon, 1em, aria-hidden) and «Finalizada». Inline-flex, small gap, nowrap.
   - When closed, «finalizada» is appended to the accessibleName parts («…, Promedio 9.95, finalizada»).
   - Open cards render nothing extra. The card stays a single RouterLink.
8. **Unchanged:** SessionsView, the router, persistence and ScoreActions.

### Files Affected
**Production:** src/stores/sessions.ts, src/composables/useScoring.ts, src/composables/useConfirm.ts, src/components/ConfirmDialog.vue, src/components/ScoreCell.vue, src/components/LockIcon.vue (new), src/components/SessionCard.vue, src/views/ScoringView.vue.

**Tests:**
- **sessions.test.ts**, `describe('setClosed')`:
  - close and reopen each bump updatedAt and persist (STORAGE_KEY read after nextTick);
  - the same value means no updatedAt change and no save;
  - an unknown id is a no-op;
  - setArrow and deleteEnd are blocked after close and work again after reopen.
- **useScoring.test.ts**:
  - closeSession locks, and select/score no-op;
  - reopenSession unlocks and moves the selection to firstEmptyCell from a different cell;
  - on a full session it selects the last cell;
  - scoring the last arrow leaves `closed` false.
- **useConfirm.test.ts**: `danger` defaults to true, and false passes through.
- **ConfirmDialog.test.ts**: the confirm button's styling differs with danger false.
- **ScoreGrid.test.ts:120-127**: non-interactive means no aria-current and no is-selected. The interactive test stays.
- **LockIcon.test.ts** (optional): aria-hidden svg.
- **ScoringView.test.ts**, updated:
  - :128-135: the only button is «Reabrir sesión»;
  - :184-196: no aria-current while closed, and a click changes nothing;
  - :457-470, from challenger note 1.
- **ScoringView.test.ts**, new (mounted with attachTo body):
  - «Finalizar sesión» sits below the delete actions with its testid, outside the delete group;
  - clicking it opens the dialog with the exact title, message and labels, and `window.confirm` is never called (spy);
  - Cancelar and Escape leave `closed` false and the keypad present, with focus back on the button;
  - Finalizar gives `closed: true`, shows the lock, removes keypad, delete actions and finalize, keeps the grid, totals and average, leaves no cell buttons and no aria-current, and puts focus on «Reabrir sesión»;
  - «Reabrir sesión» opens no dialog and sets `closed: false`, brings back keypad and delete buttons, puts aria-current on firstEmptyCell, and puts activeElement on that cell's button.
- **SessionCard.test.ts**:
  - a closed session shows card-status «Finalizada» with an aria-hidden svg, and the aria-label ends with «finalizada»;
  - an open session shows neither;
  - the card updates live on setClosed;
  - the no-nested-controls test still passes.
- **e2e/close-session.spec.ts** (new, 375 px, trackConsole empty):
  1. Create a session and score one end. «Finalizar sesión» is ≥48 px and in the viewport.
  2. «Finalizar sesión» → «Cancelar»: still open, and storage has closed false.
  3. «Finalizar sesión» → «Finalizar»: lock status shown, keypad group count 0, `table button` count 0, `[aria-current]` count 0, storage closed true. «Reabrir sesión» is ≥48 px and in the viewport.
  4. Home: the card shows «Finalizada» and its aria-label includes «finalizada».
  5. Reload: still «Finalizada». Opening the card shows the locked screen.
  6. «Reabrir sesión»: the keypad returns, the selection is on (1,0), and a key writes it.
  7. Home: no card-status. Reload: still open.
- **e2e/scoring.spec.ts**:
  - :345-357: a closed seed has no aria-current, and a tap changes nothing;
  - the fit test at :152 also asserts «Finalizar sesión» is ≥48 px and in the viewport alongside the full keypad.
- **e2e/session-list.spec.ts**: seed the CU-09 «worst» session with `closed: true` via `session()`'s `extra` argument. The card shows «Finalizada», and expectFit passes in light, dark and the wide-glyph pass. Clicking it opens the locked screen with the right totals. Only «worst» is closed, per challenger note 3.
- **No change:** offline.spec (retries stay 0), install and installability.

### Risks & Considerations
- The existing tests that assert a selection on closed sessions change on purpose, for AC4.
- Focus on confirm needs the explicit nextTick → reopenButton.focus(). Unit-test it with attachTo body and flushPromises.
- `danger` is the only change to shared CU-03 code, and its default keeps current behaviour.
- The finalize button costs about 56 px of grid height at 375×740. The scroller absorbs it, scrollIntoView keeps the active row visible, and the extended fit test guards it. The locked panel is shorter than the open controls.
- CI fonts: the card status line is short, nowrap, with a 1em icon, and the worst case is seeded closed.
- Cross-tab: there's no storage sync. setClosed is idempotent, so a confirm after an external change is safe.
- role="status" appearing on finalize will be announced, which is acceptable.
- No new dependencies. UI is in Spanish and code in English. Coverage stays ≥90 % on domain and composables.
