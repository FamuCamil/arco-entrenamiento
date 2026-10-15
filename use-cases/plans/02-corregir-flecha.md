---
plan_for: use-cases/02-corregir-flecha.md
work_branch: feat/uc-02-corregir-flecha
run: arco-entrenamiento-uc-2
approved: 2026-10-15
---

FINAL APPROVED PROPOSAL for arco-entrenamiento-uc-2 (CU-04 Corregir flecha). `challenger-2` approved v1 unchanged, with three minor notes, which are appended at the end.

TARGET_DIR = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-02-corregir-flecha (abbreviated as <T> below; all paths are absolute under it).

### Analysis
- UC01 delivered the scoring screen. `useScoring` (<T>/src/composables/useScoring.ts) exposes `selected`, `isLocked`, `score(key)` (setArrow at selected, then `nextCell`) and `activeRowRef`. **There is no `select()` yet.** UC01's plan (<T>/use-cases/plans/01-anotar-flechas.md:65) says "There is no select() (that is CU-04 / UC02)". The use case's phrase "ya existente desde CU-03" is inaccurate, so this UC adds `select`.
- `ScoreCell.vue` is a display-only `<td>` (UC01 AC21). The `td` carries `aria-current="true"` and the `is-selected` class, and `data-testid="score-cell-{row}-{col}"` falls through from ScoreGrid onto it. Its height is 2.5rem = 40 px, which fails AC4's 48 px.
- `ScoreGrid.vue` has no emits. `ScoringView.vue` wires the grid and keypad. In a closed session the lock replaces the keypad.
- Store `setArrow` (<T>/src/stores/sessions.ts:71-86) already overwrites any cell, validates bounds and key, no-ops when closed, bumps `updatedAt`, and persists via the deep watch. **No store production change is needed** (AC2, AC6).
- `firstEmptyCell` (<T>/src/domain/scoring.ts:12) already returns the first null in row-major order, so AC11 is test-only work.
- Tokens: `--touch-min: 48px`, `--color-selected-*` and `--color-focus` exist in <T>/src/styles/tokens.css. There is a global `:focus-visible` rule at tokens.css:88. `--color-focus` equals `--color-selected-border` (#2563eb).
- Out of scope: CU-05 (delete), CU-06 (sortEnd; the store's `TODO(CU-06)` stays), CU-07 (totals).

### Proposed Solution (production, developer)
1. **<T>/src/composables/useScoring.ts**: add and return `select(row, col)`.
   - No-op when `isLocked` is true or the archer is not found.
   - No-op unless `row` is an integer in [0, ends.length) AND `col` is an integer in [0, ends[row].length).
   - Otherwise it sets `selected` = `{row, col}`.
   - `score()` is unchanged. A select followed by a key press overwrites the cell and advances with `nextCell` (AC2, AC3: next arrow, wrap to the next end, stay at the last cell).
   - Update the doc comment.
2. **<T>/src/components/ScoreCell.vue**: make the cell interactive.
   - New props: `label: string` and `interactive: boolean`. New emit: `select` (no payload).
   - The root stays a `<td>` and keeps `data-testid`, `aria-current` and `is-selected`. Only the td has `aria-current`.
   - When interactive, the td holds one native `<button type="button">` filling the cell. It has `aria-label` = `label`, shows the value, and emits `select` on click. That gives native Tab focus and Enter/Space activation (AC4). No role on the td.
   - When not interactive (locked), the value is plain text with no button (AC5).
   - CSS:
     - The button gets an appearance reset (no border, transparent background, inherited font, color and weight), `width: 100%`, and `min-height: var(--touch-min)`.
     - The td uses `height: var(--touch-min)` instead of 2.5rem and has no horizontal padding when it holds a button. `min-width` stays at 2.75rem.
     - The button gets an inset focus outline (negative `outline-offset`) that is distinct from the selected outline, so it is not clipped by `.grid-scroller`'s `overflow-x: hidden`. A new token is allowed.
   - Remove the "Display-only" comment.
3. **<T>/src/components/ScoreGrid.vue**: wire the cells.
   - New prop: `interactive: boolean`.
   - New emit: `select: [row: number, col: number]`, with the global row index.
   - Pass `interactive`, `label` and `@select` to each cell.
   - Label: `Serie {s+1}, tanda {(row % endsPerSeries)+1}, flecha {col+1}: {value}`, where value is the key, «fallo» for M, or «vacía» for null. Use a local helper in the grid, not the domain layer.
4. **<T>/src/views/ScoringView.vue**: destructure `select`. Pass `:interactive="!isLocked"` and `@select="select"` to ScoreGrid.
5. **No changes** to the store, domain, router, or tsconfig. The tsconfig.node.json DOM-lib follow-up is NOT needed. tokens.css changes only if a focus token is added.

### Test changes (QA)
**Tests that must change because of UC01 AC21 (AC7):**
- <T>/src/components/ScoreGrid.test.ts:88-94, "cells are not interactive". **Replace it.** It is the only test asserting AC21.
- <T>/src/components/ScoreGrid.test.ts:11-13: the `grid()` helper passes `interactive` (default true; a param for false).
- No other existing test should change. Run the suite to confirm. The closed-session "0 buttons" test in ScoringView.test.ts stays valid.

**New tests:**
- useScoring.test.ts, `describe('select')`:
  - selects any cell (filled, empty, not first empty)
  - select then score overwrites and advances
  - the last arrow of an end wraps to (row+1, 0)
  - the last session cell stays
  - out-of-order writing leaves earlier gaps null
  - no-op when closed, including when it becomes closed reactively
  - no-op for an unknown archer
  - no-op for out-of-range or non-integer row/col, covering both a row and a col out of range
  - a fresh composable selects the first gap (AC11), and the correction is persisted (AC6)
- sessions.test.ts:
  - overwriting a cell in a complete end leaves the other cells untouched, is persisted, and does NOT re-sort the end (pins CU-06)
  - writing to a later row while an earlier row is empty
- ScoreGrid.test.ts:
  - one button per cell when interactive, and none when not
  - clicking emits `select` with the global (row, col), e.g. (13,2)
  - aria-label for X, for M («fallo»), for empty («vacía»), and for series 2 numbering
  - buttons are `type="button"`
- ScoringView.test.ts:
  - clicking a filled cell moves `aria-current`; the next key press overwrites and advances
  - in a closed session, clicking changes nothing
  - a seeded gap selects the first empty cell on entry
- Coverage stays ≥ 90 % lines on `src/domain/**` and `src/composables/**` (AC8).

**e2e (<T>/e2e/scoring.spec.ts), reusing `seed`/`cell`/`expectSelected`/`trackConsole`:**
- AC9: open the test session and score X, 9, M. Tap (0,1) and assert it is selected. Press «Anotar 7». Assert (0,1) shows 7, the selection is (0,2), and the row is not re-sorted. Reload, then assert (0,1) is still 7 and the selection is at (1,0).
- AC4: the cell height is ≥ 48 px at 375 px. The button is found by its accessible name (e.g. «Serie 1, tanda 1, flecha 2: 9»). Focus a cell and press Enter, then another cell and press Space; the selection follows each time.
- AC5: in a closed seeded session, clicking a cell leaves the selection and values unchanged, and no cell buttons exist.
- AC11: seed a gap (row 0 filled, row 1 empty, row 2 filled) and assert the selection on load is the first gap.
- No console errors.

### Files Affected
- **Production (developer):**
  - <T>/src/composables/useScoring.ts
  - <T>/src/components/ScoreCell.vue
  - <T>/src/components/ScoreGrid.vue
  - <T>/src/views/ScoringView.vue
  - <T>/src/styles/tokens.css, only if a focus token is added
- **Test (qa):**
  - <T>/src/components/ScoreGrid.test.ts
  - <T>/src/composables/useScoring.test.ts
  - <T>/src/stores/sessions.test.ts
  - <T>/src/views/ScoringView.test.ts
  - <T>/e2e/scoring.spec.ts
  - <T>/tests/fixtures.ts, optional

### Risks & Considerations
- **Use-case inaccuracy:** `select()` does not exist yet. This UC adds it, consistent with UC01's plan.
- **Accessibility:** a button inside the td keeps table semantics and native keyboard support. `aria-current` stays on the td, so there is one marked element and the existing tests hold. Rejected alternative: a disabled button when locked, which would break the existing "0 buttons" view test and add nothing.
- **Focus vs selection** share a colour today. The inset, distinct focus ring avoids clipping (WCAG 2.4.7).
- **Layout:** cells grow from 40 to 48 px tall, and the width is unchanged. 12-arrow ends overflowing 375 px is pre-existing and out of scope.
- **CU-06 pitfall:** a correction does not re-sort. This is pinned by unit and e2e assertions that CU-06 will update.
- **AC11** is already handled by `firstEmptyCell`.
- **Closed session:** double guard (no buttons rendered, plus `select` checks `isLocked`).

### Challenger's minor notes (for the developer and QA)
1. The replacement for the AC21 test asserts focusability on the cell *button* (native, no tabindex), not on the td.
2. The `select` bounds check validates `col < ends[row].length`, not only the row.
3. Locked cells have no aria-label. That is acceptable (caption and headers give context), so QA must not assert labels on locked cells.
