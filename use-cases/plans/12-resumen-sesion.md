---
plan_for: use-cases/12-resumen-sesion.md
work_branch: feat/uc-12-resumen-sesion
run: arco-entrenamiento-uc-12
team: [analyst-uc12, challenger-uc12, developer-uc12, qa-uc12]
approved: 2026-10-17
---

UC12 (arco-entrenamiento-uc-12) challenger verdict: APPROVE, round 1. No Critical/Major issues. The full approved proposal is below.

### Verdict
Approve.

### Strengths
- Tiebreak columns use distinct positive points via zonePoints (X counted with the equal-points zone, 3D zones that share points share a column, M is never a column, fewer than 2 values handled). Headers show points, not keys.
- All totals, maxes and the average come from useSessionStats/scoring.ts, so they match the scoring screen by construction.
- «Resumen» sits in the scoring header, and the grid scroller absorbs the extra height. Fit tests are extended with a wide-glyph pass.
- The CU-10 finalize-focus tests are adapted on purpose. The summary heading takes focus on mount.
- The table is semantic, the counts have accessible names, "not found" is split into session and archer cases, there is no scope creep and no new dependencies.

### Recommendations (minor, non-blocking; also sent to the analyst)
1. Every router used by a ScoringView unit test that triggers Finalizar needs the `summary` route. Otherwise the push fails with a no-match warning and trips the console guard.
2. Averages are shown as «Promedio: 9.03» (with a colon), as on the scoring screen. AC6's sample text has no colon. Reusing the scoring format is correct, so note it so QA does not flag it.
3. For a zero-arrow session, assert that per-end counts are blank and series/grand counts show «0».
4. In the zoneDistribution comment, say that unknown keys are left out.

---
## APPROVED PROPOSAL (analyst-uc12, v1)

### Analysis
Base: worktree /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-12-resumen-sesion (TARGET). Brief frontmatter: Vue 3.5/Pinia/Router 4, paths.production src/**, e2e/**; profiles []. Brief lines 362/370/384 name SummaryTable.vue, SummaryView.vue and route `/session/:id/summary` (`?archer=`).
- Router (src/router/index.ts) has `/`, `/new`, `/session/:id/score/:archerId` (name `scoring`, lazy, props:true). App.vue:13 keys RouterView by `$route.path`, so scoring→summary remounts.
- Totals: src/composables/useSessionStats.ts gives endTotals/runningTotals (null for unstarted ends, AC7 of UC05), seriesTotals, grandTotal, endMax/seriesMax/grandMax, average, averageLabel («Promedio: 8.67», with colon). SessionCard.vue:33-36 has a colon-less variant. Scoring shows the colon form.
- Faces (src/domain/targetFaces.ts): WA X=10 + 10..lowest + M; wa-80-6 lowest 5; wa-40-triple lowest 6; field X=6, 6, 5..1, M; 3D 11,10,8,5,M. `zonePoints` (scoring.ts:6) returns 0 for null/unknown keys. Persisted state only type-checks keys (persistedState.ts:29), so unknown keys can exist in hydrated data.
- ScoringView.vue:61-73 confirmClose: closeSession(), nextTick, reopenButton.focus(). useConfirm.settle focuses returnFocusTo on nextTick only if isConnected (useConfirm.ts:38-42).
- ScoringView header (ScoringView.vue:92-95): flex-wrap, baseline, h2 «A - Yo» + average. `.grid-scroller` is flex:1/min-height:0, so a taller header shrinks the grid, not the keypad (plan 10 line 31 lesson).
- Tests that pin current finalize focus: src/views/ScoringView.test.ts ~574-603 («focus on Reabrir sesión»), e2e/close-session.spec.ts:96-113 (asserts locked screen + reopen focused right after Finalizar). ScoringView.test.ts routers (view() at :39-51, viewWithDialog() at :233-246) have no `summary` route, so a named RouterLink to it would throw/warn and break the console guard.
- html/body have overflow-x:hidden (tokens.css), so horizontal fit must measure `.app-main` and descendants, as in session-list.spec.ts measureFit (:48-103) with its light/dark + `letter-spacing: 0.1em` wide-glyph pass (:288-290).

### Proposed Solution
1. Pure domain — new /src/domain/summary.ts (no Vue imports, like scoring.ts):
   - `tiebreakPoints(face)`: distinct points > 0 from face.zones, descending, first two. WA → [10, 9]; wa-80-6 → [10, 9]; field → [6, 5]; 3D → [11, 10]. Fewer than two distinct positive values → returns what exists ([] or one). Never uses key text or parseInt.
   - `tiebreakCounts(ends, face, points)`: one count per value in `points` = number of arrows whose `zonePoints(key, face)` equals it (so X=10 counts in «10», field X=6 in «6», two 3D zones sharing points share a column). Null/unknown keys never count (they score 0, and 0 is never a column).
   - `tiebreakTable(ends, endsPerSeries, face)` returning `{ points, perEnd: number[][], perSeries: number[][], total: number[] }`, built from tiebreakCounts over [end], the series slice (same floor(row/endsPerSeries) grouping as seriesTotal), and all ends.
   - `zoneDistribution(ends, face)`: `{ zone: ScoringZone, count }[]` in catalogue order (X, 10, 9 … M), zones with 0 included, counted by exact key match. Sum equals the arrows shot with catalogue keys.
2. Route — /src/router/index.ts: add `{ path: '/session/:id/summary', name: 'summary', component: () => import('@/views/SummaryView.vue'), props: (route) => ({ id: String(route.params.id), archerId: typeof route.query.archer === 'string' ? route.query.archer : undefined }) }` (a props function that normalises the query, array/missing → undefined). Update the comment at :5.
3. SummaryTable — new /src/components/SummaryTable.vue, presentational (props only, no store): endsPerSeries, rowCount, endTotals, runningTotals, seriesTotals, grandTotal, endMax, seriesMax, grandMax (same shapes as ScoreGrid.vue props :8-27), tiebreakPoints, endCounts, seriesCounts, grandCounts. One semantic `<table aria-label="Resumen por tandas">`, table-layout fixed, width 100%:
   - thead: `th scope=col` «T.» (abbr «Tanda», as ScoreGrid), «Total», «Acum.» (abbr «Acumulado»), then one `th scope=col` per tiebreak value showing the points («10», «9») with `aria-label="Flechas de 10"` etc.
   - one `<tbody>` per series: first row `th scope="rowgroup" colspan=all` «Serie n»; one row per end: `th scope=row` end number, end total as «27/30» (same `shown(value, max)` rule as ScoreGrid.vue:72-75, blank when null), running total, counts (blank when the end is unstarted, i.e. endTotals[row] === null); then a total row: `th scope=row colspan=3` «Total Serie n: X/máx» + series counts.
   - tfoot: `th scope=row colspan=3` «TOTAL GENERAL: X/máx» + grand counts.
   - Texts identical to ScoreGrid («Total Serie 1: 40/300», «TOTAL GENERAL: 40/600»). Colspans derive from tiebreakPoints.length (0–2).
   - Widths for wide fonts: T. 1.875rem; Total 4rem («132/132»); Acum. 3.5rem; count columns share the rest; tabular-nums, 0.8125rem like `.total`. Total-row label cells allow wrapping (`white-space: normal; overflow-wrap: anywhere`).
   - data-testids: summary-end-total-{row}, summary-running-total-{row}, summary-count-{row}-{k}, summary-series-total-{s}, summary-series-count-{s}-{k}, summary-grand-total, summary-grand-count-{k}.
4. SummaryView — new /src/views/SummaryView.vue, props `id: string`, `archerId?: string`, read once at setup like ScoringView. Resolves session (store.getSession), archer (`archerId` ? find by id : archers[0]) and face (getTargetFace). Calls useSessionStats(id, resolvedArcherId ?? '') for every total, max and averageLabel, plus computeds over tiebreakTable / zoneDistribution on the archer's ends.
   - Header: `<h2 ref tabindex="-1">Resumen</h2>`; archer line «A - Nombre» (data-testid summary-archer); `formatDisplayDate(date)`; place `location.trim() || 'Sin lugar'`, wrapping with overflow-wrap:anywhere; distance «18 m» / «Variable» (0); face name. Same label rules as SessionCard.vue:23-28 (no shared helper). If closed: «Finalizada» with LockIcon (aria-hidden, 1em), data-testid summary-status.
   - Navigation row under the header: two RouterLinks styled as buttons (min-height var(--touch-min), 2-column grid, text centred, wrapping): back to `{ name: 'scoring', params: { id, archerId: resolved } }`, «Volver a anotar» when open / «Ver tabla» when closed, data-testid summary-back; «Inicio» to `/`, data-testid summary-home. Outlined accent like .close-session.
   - Then SummaryTable; then average (stats.averageLabel, data-testid summary-average); then «Reparto por zonas»: `h3` + `ul aria-labelledby` flex-wrap, one `li` per zone (data-testid zone-count-{key}) with a chip in the zone's bg/fg (inline style) showing the key, then the count. Chip border 1px solid #6b7280.
   - Not found: unknown session or face → «No se encontró la sesión.»; existing session but unknown/missing archer → «No se encontró el arquero.»; both with RouterLink «Volver al inicio» to `/`. No console output.
   - Focus: onMounted → heading.focus() when found.
   - Read-only: no `<button>`, input or store writes. Root scrolls in .app-main.
5. ScoringView — /src/views/ScoringView.vue:
   - Header becomes two columns: left block (h2 + average, flex-wrap, min-width 0); right a RouterLink «Resumen» (`{ name: 'summary', params: { id }, query: { archer: archerId } }`, data-testid open-summary, inline-flex, min-height var(--touch-min), flex:none, nowrap, outlined accent), in both open and locked states (a link, so «only button is Reabrir sesión» still holds).
   - confirmClose: on ok → closeSession(); `await router.push({ name: 'summary', params: { id }, query: { archer: archerId } })`. Remove nextTick + reopenButton.focus() (and the ref if unused); update doc comment. Cancel path unchanged.
6. Home cards unchanged.

### Files Affected
Production (new): src/domain/summary.ts, src/components/SummaryTable.vue, src/views/SummaryView.vue. Modified: src/router/index.ts, src/views/ScoringView.vue.
Test:
- src/domain/summary.test.ts (new): wa-40, wa-80-6, wa-field, 3d; empty/partial/full; synthetic faces with one positive value and only M; nulls and unknown keys ignored; per-end/per-series/total; distribution order, zeros, sum.
- src/components/SummaryTable.test.ts (new): scope attrs, aria-label, head texts and «Flechas de n», row/series/grand texts, blank unstarted rows incl. counts, 0/1 tiebreak columns adjust colspans.
- src/views/SummaryView.test.ts (new; router with `/`, scoring, summary; warn/error spies): header fields, «Finalizada» only when closed, default/`?archer` selection, not-found messages, totals and average equal to useSessionStats (field and 3D too), no buttons/inputs, back-link label/href per state, home link, heading focused on mount.
- src/views/ScoringView.test.ts: `summary` stub route in both routers; viewWithDialog exposes router; «Resumen» href in open and closed state; rewrite the «Finalizar locks…» test (closed true, stored closed, currentRoute summary with archer=a1, no reopen-focus assertion). Cancel/Escape unchanged.
- e2e/summary.spec.ts (new, 375 px, trackConsole empty): score X,10,9 twice; «Resumen» → URL, «TOTAL GENERAL: 58/600», «Flechas de 10» 4, «9» 2, distribution X2/10 2/9 2/others 0/sum 6, «Promedio: 9.67»; «Volver a anotar» → Finalizar → summary, heading focused, «Finalizada»; «Ver tabla» → locked + «Reabrir sesión»; browser Back returns to scoring; seeded worst case (3D, 2×6×12 all «11» → 1584/1584, 70-char place, closed) light/dark + 0.1em letter-spacing: no `.app-main`/document overflow, no descendant outside the content box, nav links ≥48 px, distribution wraps.
- e2e/scoring.spec.ts fit test (:152): «Resumen» ≥48 px in viewport with full keypad and «Finalizar sesión»; wide-glyph pass on `.scoring-header` keeps `.app-main` overflow ≤ 0.
- e2e/close-session.spec.ts:96-113: after «Finalizar» expect summary URL, focused heading, «Finalizada»; then «Ver tabla» and keep the locked-state assertions minus the reopen-focus check. offline.spec untouched.

### Risks & Considerations
- Average format: reuse averageLabel («Promedio: 9.03») to match scoring (AC6 wording lacks the colon).
- Unknown zone keys count for the average but appear in no zone; documented.
- «Resumen» costs about 18 px of grid height at 375×740; the extended fit test guards CI fonts; long names wrap on the left only.
- The heading takes focus on every summary mount.
- App.vue keys by path; a `?archer` change alone does not remount (harmless with one archer).
- No new dependencies; UI in Spanish, code in English; summary.test.ts keeps src/domain coverage.
