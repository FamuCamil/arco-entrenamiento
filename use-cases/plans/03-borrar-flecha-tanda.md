---
plan_for: use-cases/03-borrar-flecha-tanda.md
work_branch: feat/uc-03-borrar-flecha-tanda
run: arco-entrenamiento-uc-3
approved: 2026-10-15
---

UC03 (arco-entrenamiento-uc-3) verdict: Approve. Proposal v1 from analyst-uc3 is approved in round 1 with only Minor issues. The full approved proposal follows the verdict.

## Challenger verdict
**Approve**

Strengths: all 11 ACs and the CU-06 pitfall are mapped. The scope is tight (no CU-06, CU-07 or CU-12 work). Store, composable, view and dialog layers are separated cleanly, and useConfirm/ConfirmDialog are generic for CU-12 reuse. The aria-disabled choice is justified for AC3, and Playwright toBeDisabled honors aria-disabled on buttons. The Playwright project is Pixel 5 (Chromium), so focus-return works in the gate.

Minor issues (fold into implementation and tests, no revision needed):
1. Escape and the Tab trap are bound to the panel's keydown. Clicking non-focusable panel padding can move focus to body, and then Escape stops working. Fix: give the panel tabindex="-1", or attach the keydown listener on document while open and remove it on close.
2. On iOS Safari a tap does not focus the button, so the return-focus target there may be body. Add the optional `returnFocusTo?: HTMLElement` option to confirm(), falling back to document.activeElement.
3. Tests: the dialog's «Borrar» button partially matches the «Borrar flecha» and «Borrar tanda» role names. Use `exact: true` or the data-testids.
4. ScoringView.test must also reset the useConfirm singleton with an afterEach settle(false).

---
## Approved proposal (analyst-uc3, v1)

TD = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-03-borrar-flecha-tanda

### Analysis
- Brief frontmatter: Vue 3.5, Pinia, TS, Vitest (jsdom), Playwright, profiles: []. The 90% line coverage gate applies to src/domain/** and src/composables/**. The brief already plans store deleteEnd, useScoring deleteArrow/deleteEnd ("returns to the end's first arrow"), composables/useConfirm.ts, components/ScoreActions.vue and components/ConfirmDialog.vue.
- TD/src/stores/sessions.ts: setArrow(sessionId, archerId, row, arrow, key|null) is already a no-op when the session is closed or the target is invalid, and it accepts null. There is no deleteEnd yet. A deep watch persists every change.
- TD/src/composables/useScoring.ts: selected, isLocked, select, score, activeRowRef.
- TD/src/views/ScoringView.vue: the lock block when isLocked, otherwise <ScoreKeypad> (v-if/v-else).
- ScoreKeypad.vue is the style reference: --touch-min 48 px, Spanish aria-label, type=button, the :disabled style. tokens.css has --color-danger, --touch-min, a global :focus-visible and the safe-area vars.
- App.vue holds the header and RouterView. The grid labels rows «Serie S, tanda T».

### Proposed Solution
1. Store (TD/src/stores/sessions.ts): add deleteEnd(sessionId, archerId, row). It is a no-op if the session is missing or closed, the archer is missing, or row is not an integer or is out of range. Otherwise it sets each arrow of ends[row] to null in place (index assignment), bumps updatedAt, and is exported. There is no sorting. Deleting a single arrow reuses setArrow(..., null) unchanged. Update the doc comment at the TODO(CU-06) line: null writes never sort, so the gap stays.
2. useScoring (TD/src/composables/useScoring.ts):
   - canDeleteArrow (computed): not locked, the archer exists, and the selected cell is not null.
   - canDeleteEnd (computed): not locked, the archer exists, and the selected row has some non-null value.
   - deleteArrow(): guarded by canDeleteArrow. Calls store.setArrow(..., row, col, null). The selection is unchanged (AC1).
   - deleteEnd(): guarded by canDeleteEnd. Calls store.deleteEnd(..., row) and sets selected = {row, col: 0} (AC2).
   - Both are synchronous and do no confirmation. Return all four.
3. New TD/src/composables/useConfirm.ts (generic, AC4):
   - Module-level singleton: a reactive pending request (null or { title, message, confirmLabel, cancelLabel }), plus the resolver and the return-focus element.
   - useConfirm() returns { confirm, state (readonly), settle(result) }.
   - confirm({ title, message, confirmLabel? = «Aceptar», cancelLabel? = «Cancelar», returnFocusTo? }) returns Promise<boolean>. It records returnFocusTo, or else document.activeElement (if it is an HTMLElement), as the return focus. If a request is already pending, that one is first resolved with false. It never uses window.confirm.
   - settle(result) resolves the promise, clears the state, then after nextTick refocuses the recorded element if it is still connected.
   - CU-12 reuse example: confirm({ title: '¿Eliminar la sesión?', ..., confirmLabel: 'Eliminar' }).
4. New TD/src/components/ConfirmDialog.vue (the single host, no props):
   - Renders while the state is pending: a fixed full-viewport backdrop (click cancels), then a panel with role="dialog", aria-modal="true", aria-labelledby on the h2 title and aria-describedby on the message paragraph.
   - Buttons are type=button, Cancel first and then Confirm, with the confirm button in the danger color.
   - On open (watch, then nextTick) it focuses Cancel. Escape gives settle(false). Tab and Shift+Tab wrap between the first and last button (the focus trap, AC3). Per Minor 1, the panel gets tabindex="-1" or the keydown listener is on document while open.
   - Buttons are at least --touch-min, side by side, full width, with the global :focus-visible.
   - At 375 px the panel is bottom-anchored with --safe-bottom padding for thumb reach. Max-width about 28rem, centered on wider screens. Existing tokens only, light and dark themes.
   - Uses a div with a role, not native <dialog>/showModal (unreliable in jsdom). No Teleport.
   - Mounted once in TD/src/App.vue after <main>.
5. New TD/src/components/ScoreActions.vue (presentational):
   - Props canDeleteArrow and canDeleteEnd (boolean). Emits deleteArrow and deleteEnd.
   - role="group" with aria-label «Acciones de borrado», holding two type=button buttons:
     - visible «Borrar flecha», aria-label «Borrar flecha seleccionada», data-testid delete-arrow
     - visible «Borrar tanda», aria-label «Borrar tanda seleccionada», data-testid delete-end
     - (label-in-name, WCAG 2.5.3)
   - Disabled state: aria-disabled="true" plus a guarded click (no emit), not native disabled, so the button keeps its focus and focus can return to it after the action (AC3). Styled like .key:disabled.
   - Two equal columns, at least 48×48, a muted bordered style, with a subtle danger accent on «Borrar tanda».
6. View (TD/src/views/ScoringView.vue):
   - Destructure canDeleteArrow, canDeleteEnd, deleteArrow and deleteEnd.
   - Wrap the keypad and <ScoreActions> in the v-else branch (a template or a wrapper div that keeps flex: none), so neither renders when locked (AC6).
   - deleteArrow calls deleteArrow directly.
   - deleteEnd uses an async handler. It computes s = floor(row/endsPerSeries)+1 and t = row%endsPerSeries+1, then awaits confirm({ title: '¿Borrar la tanda?', message: 'Se borrarán todas las flechas de la serie S, tanda T. No se puede deshacer.', confirmLabel: 'Borrar' }) (passing the «Borrar tanda» button as returnFocusTo where available). It calls deleteEnd() only on true. On false nothing changes.

AC mapping:
- AC1, AC2, AC5: store and composable.
- AC2, AC3, AC4: useConfirm and ConfirmDialog.
- AC6: the view's v-else plus the setArrow and deleteEnd guards.
- AC7: ScoreActions.
- AC8: the deep-watch persistence.
- AC9, AC10: the QA tests.
- AC11: the full gate.

### Files Affected
Production (developer):
- TD/src/stores/sessions.ts (modify)
- TD/src/composables/useScoring.ts (modify)
- TD/src/composables/useConfirm.ts (new)
- TD/src/components/ConfirmDialog.vue (new)
- TD/src/components/ScoreActions.vue (new)
- TD/src/views/ScoringView.vue (modify)
- TD/src/App.vue (modify)

Tests (qa):
- TD/src/stores/sessions.test.ts: describe('deleteEnd'). It empties only the target row, bumps updatedAt and persists. It is a no-op when closed (values and updatedAt unchanged). It is a no-op for an unknown session or archer, a non-integer row and an out-of-range row. Keep the existing setArrow-closed test.
- TD/src/composables/useScoring.test.ts:
  - deleteArrow: clears the cell, keeps the selection and persists; no-op on an empty cell, when closed, and for an unknown archer.
  - deleteEnd: clears the row and selects {row, 0}; works from a middle column; other rows untouched; no-op on an empty end (selection unchanged), when closed, and for an unknown archer.
  - canDeleteArrow and canDeleteEnd, including a reaction to the session closing.
  - Pitfall: deleting the middle arrow of a full end leaves a null gap and does not reorder.
- TD/src/composables/useConfirm.test.ts (new):
  - resolves true or false via settle
  - state labels, with defaults «Aceptar» and «Cancelar»
  - a second confirm resolves the first with false
  - focus is restored to the opener (and to returnFocusTo when given), and not attempted for a detached element
  - afterEach settle(false)
- TD/src/components/ConfirmDialog.test.ts (new):
  - role, aria-modal, labelledby and describedby, Spanish texts
  - Cancel is focused on open
  - Escape cancels (including after clicking panel padding); Tab and Shift+Tab wrap; a backdrop click cancels; the confirm button resolves true
  - attachTo document.body
- TD/src/components/ScoreActions.test.ts (new): a labelled group, visible text and aria-label, type=button, aria-disabled reflects the props, no emit while disabled, emits when enabled.
- TD/src/views/ScoringView.test.ts: a wrapper holding ScoringView and ConfirmDialog; afterEach settle(false). Cases: delete arrow; delete end with cancel and with confirm; actions absent when closed.
- TD/e2e/scoring.spec.ts at 375 px, after seeding partial ends (use exact: true or data-testids to avoid «Borrar» partial matches):
  1. Borrar flecha: the cell is empty and the selection stays.
  2. Borrar tanda, then Cancelar: no change, and focus returns to the button.
  3. Borrar tanda, then Escape: also a cancel.
  4. Borrar tanda, then Borrar: the end is empty and its first arrow is selected.
  5. Reload: the state matches and no dialog is shown.
  Also: the actions are hidden in a closed session, and the buttons and dialog buttons are at least 48×48. Keep trackConsole.

### Risks & Considerations
- aria-disabled departs from ScoreKeypad's native disabled on purpose, to keep focus for AC3.
- The return-focus capture relies on document.activeElement, which iOS Safari does not set on tap (addressed by returnFocusTo, Minor 2).
- The useConfirm singleton leaks across tests, so it must be reset in afterEach.
- There is no inert background. The backdrop and the focus trap are enough for the MVP.
- CU-06: null writes never complete an end, so a future sortEnd must only sort on a write that completes the end. The gap stays, and a test pins this.
- deleteEnd bumps updatedAt only when it runs. The composable guards prevent running it on an empty end.
- Out of scope: CU-12, undo, CU-06 sorting, CU-07 totals.
