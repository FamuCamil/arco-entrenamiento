---
plan_for: use-cases/05-totales-en-vivo.md
work_branch: feat/uc-05-totales-en-vivo
run: arco-entrenamiento-uc-5
approved: 2026-10-15
---

UC05 (arco-entrenamiento-uc-5): challenger-uc5 approves analyst-uc5's proposal, rev 2, after 2 rounds. The full proposal and the verdict follow.

Orchestrator note: the user asked for an autonomous run. The three brief-vs-use-case conflicts below are resolved in favour of the use case as proposed (it is the more specific, user-approved contract); the user is informed in the run summary.

## VERDICT: Approve

### Strengths
- I checked the AC12 width arithmetic against the real CSS:
  - `.app-main` has a 16 px gutter on each side, which leaves 343 px.
  - The columns take end 32 + Total 48 + Acum. 36 = 116 px, so each of the 6 arrow columns gets about 37.8 px.
  - Arrow cells stay 48 px tall (`--touch-min`).
  - Cells 48 px wide are impossible next to the totals: 6×48 = 288 px, which leaves 55 px for three columns.
- The analyst found that `.grid-scroller` has `overflow-x: hidden`, so a page-level scrollWidth check cannot catch overflow. The e2e test measures element geometry instead.
- In round 1 I raised one Major issue: `table-layout: fixed` lets text overflow inside a cell without the table getting wider. It is fixed:
  - The total cells use `white-space: nowrap`, at most 2 px horizontal padding and 0.875rem font.
  - A worst-case e2e test (wa-122 with 6 arrows, all X, so «60/60» and «360») checks every total and header cell for overflow.
  - The same check runs again on WA 40 with 3 arrows.
- Points always come from zone `points`, and every function takes the face, so field X = 6 and 3D allows 11. The end maxima are 30/18/22.
- AC5/AC9: the average rounds as `Math.round(total*100/shot)/100` and is shown with `toFixed(2)` («8.67», always a point), or «Promedio: —».
- AC7: the "unstarted end shows blank" rule lives in one place, the composable. Series and grand totals are always numeric.
- AC10/11: the stats are computed only from in-place reactive mutations and are never persisted.
- topCounts and CU-08 stay out of scope.

### Conflicts between the brief and the use case
The plan follows the use case each time. None blocks this run.
1. Arrow cells are about 38 px wide, not the brief's "48x48 px minimum touch targets". Height stays at 48 px, which is above WCAG 2.5.8 AA (24 px). The use case's own pitfall section foresees narrower cells.
2. The brief gives signatures like `endTotal(end)` with no face argument. They now take the face, because points can't be computed without it.
3. The brief's ScoringView section says useScoring exposes `average/total/max`. Its architecture list and the use case put them in `useSessionStats`. The plan uses only useSessionStats, so useScoring is unchanged.

### Recommendations (non-blocking)
- If the per-cell `scrollWidth` check is flaky on `<td>`, compare the width of an inner `<span>` with the cell's content box.
- Running totals of 5 digits in large custom sessions may be tight. No AC covers that.

---

## APPROVED PROPOSAL (rev 2, analyst-uc5)

### Analysis
- The domain already has zonePoints, firstEmptyCell, nextCell and sortEnd. useSessionStats does not exist yet.
- ScoreGrid renders one table per series. ScoringView wraps it in `.grid-scroller`, which has `overflow-y: auto` and `overflow-x: hidden`.
- Store mutations (setArrow including the CU-06 sort, and deleteEnd) change the reactive ends arrays in place. Values computed from them therefore recalculate on score, correction, deletion and reorder (AC10).
- Brief vs use case:
  - The functions take a face argument, because points come from the face's zones.
  - The stats live only in useSessionStats, not also in useScoring.
- Width at 375 px: 343 px are usable. Today's layout already uses 320 px before any totals. Arrow cells 48 px wide can't fit beside the totals. The scroller clips overflow, so tests must measure element geometry.

### Proposed Solution
1. **Domain, `src/domain/scoring.ts`.** All functions are pure and take the face.
   - `maxArrowPoints(face)`: the highest zone points on the face, or 0 if the face has no zones.
   - `endTotal(end, face)`: the sum of `zonePoints` for the end.
   - `seriesRunningTotal(ends, row, endsPerSeries, face)`: the total from row `floor(row/eps)*eps` up to that row, inclusive. Returns 0 for a row out of range.
   - `seriesTotal(ends, series, endsPerSeries, face)`: the total of one series.
   - `grandTotal(ends, face)`: the total of all ends.
   - `averagePerArrow(ends, face)`: null when no arrows were shot. Otherwise `Math.round(total×100/shot)/100`, where shot counts the non-null cells.
   - Maxima follow AC4. They come from the session's own `arrowsPerEnd`, `endsPerSeries` and `ends.length`, times `maxArrowPoints`.
2. **New composable, `src/composables/useSessionStats.ts`.**
   - Signature: `useSessionStats(sessionId, archerId)`.
   - Lookups: `store.getSession` and `store.getArcher`, and the face through `getTargetFace` from `@/domain/targetFaces`, like useScoring.
   - It exposes only computed refs and writes nothing to the store or to persisted state:
     - `arrowMax`, `endMax`, `seriesMax`, `grandMax`.
     - `endTotals` and `runningTotals`: one entry per row, null when the end is unstarted (the AC7 rule, commented in one place). An end holding only M counts as started and shows 0.
     - `seriesTotals` and `grandTotal`: always numeric.
     - `average`, and `averageLabel`: «Promedio: 8.67» or «Promedio: —».
   - Safe defaults when the session or face is missing.
3. **`ScoreGrid.vue`.** It stays presentational and receives the stats as props.
   - colgroup and `table-layout: fixed` with `width: 100%`. Columns: end 2rem, arrow columns sharing the remaining width, Total 3rem (may be shaved to 2.875rem), Acum. 2.25rem.
   - Header row: «T.» in `<abbr title="Tanda">`, then 1..n, then «Total», then «Acum.» in `<abbr title="Acumulado">`.
   - Each row gets two non-interactive cells, `end-total-${row}` («X/endMax») and `running-total-${row}`. Both are blank when the value is null. They use nowrap, at most 2 px horizontal padding and 0.875rem font.
   - Each series gets a tfoot row, `series-total-${s}`: one cell spanning all columns, «Total Serie n: X/seriesMax».
   - After the last table, still inside the grid, a `grand-total` block: «TOTAL GENERAL: X/grandMax».
4. **`ScoreCell.vue`.** Drop `min-width: 2.75rem`. The height stays at 48 px.
5. **`ScoringView.vue`.**
   - Calls useSessionStats.
   - The header becomes a wrapping flex row: the h2 «A - Yo» plus the `average` element (`averageLabel`). There is no aria-live.
   - Closed sessions show the same totals, read-only.
6. **Checks (AC15).** `npm run lint`, `typecheck`, `test`, `test:e2e` and `build` must all pass.

### Files Affected
Developer:
- `src/domain/scoring.ts`
- `src/composables/useSessionStats.ts` (new)
- `src/components/ScoreGrid.vue`
- `src/components/ScoreCell.vue`
- `src/views/ScoringView.vue`

QA:
- `src/domain/scoring.test.ts`:
  - AC1–5 on WA 40, field and 3D, including the brief's mandatory cases: 19, 12, 16 and an average of 9.00.
  - A running total across a series boundary: row 10 of a 2×10 session starts fresh.
  - `maxArrowPoints` returns 10, 6 and 11.
  - The average is null when nothing was shot. Rounding: 26/3 gives 8.67.
- `src/composables/useSessionStats.test.ts` (new):
  - Every computed value.
  - Maxima: WA 40 with 3 arrows gives 30/300/600, field gives 18, 3D gives 22.
  - Unstarted ends are null; partial ends and M-only ends are numeric.
  - Recomputation after setArrow, deleteEnd and a sort.
  - Both average labels, and the defaults when the session is missing.
- `src/components/ScoreGrid.test.ts`:
  - Headers are [T., 1..n, Total, Acum.] (this replaces the current 'Tanda' expectation).
  - Row total and running total cells, tfoot series rows and the grand total.
- `src/views/ScoringView.test.ts`: the average sits in the header and updates after a key press.
- `e2e/scoring.spec.ts`:
  - Parameterize `seed()` with faceId and dimensions, keeping the current defaults.
  - AC14 at 375 px: score two ends and check row totals, running totals, series total, grand total and average. Delete an arrow and check that everything recomputes.
  - AC12 worst case: wa-122 2×6×6 with series 1 all 'X'. Assert:
    - The table's right edge is ≤ the scroller's right edge, and every column is within 375 px.
    - Every total, running total and header cell has scrollWidth ≤ clientWidth.
    - Every arrow cell button is ≥ 48 px tall.
  - Repeat the overflow check on WA 40 with 3 arrows («30/30»).

### Risks & Considerations
- AC7 is provisional. Until the behavior is checked against ArcheryReg, unstarted rows show blank. Only the null rule in the composable would change.
- The brief-vs-use-case conflicts are listed under the verdict above.
- Overflow is clipped by the scroller and, in fixed layout, by the cells. That's why the tests measure geometry and per-cell overflow.
- 5-digit running totals in large custom sessions may be tight. No AC covers that.
- Coverage on `src/domain/**` and `src/composables/**` must stay ≥ 90 % (AC13).
- topCounts and CU-08 are out of scope.
