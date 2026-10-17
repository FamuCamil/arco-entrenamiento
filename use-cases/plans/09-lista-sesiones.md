---
plan_for: use-cases/09-lista-sesiones.md
work_branch: feat/uc-09-lista-sesiones
run: arco-entrenamiento-uc-9
approved: 2026-10-17
---

UC-09 (arco-entrenamiento-uc-9): challenger-uc9 approved analyst-uc9's proposal in round 1. There are no Critical or Major issues. The full approved proposal follows, with five Minor recommendations folded in under "Challenger amendments".

Orchestrator note (amendment 4): the card's average label is «Promedio 9.03» / «Promedio —», with no colon. This is intended, per AC6. The scoring screen keeps «Promedio: 9.03».

TD = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-09-lista-sesiones

## Verdict: Approve

## Analysis (analyst)
- TD/src/views/SessionsView.vue:2-3 has the TODO(CU-09).
  - :21-31 hold the provisional `<ul aria-label="Sesiones guardadas">` over `store.sortedSessions`. Each li has a RouterLink to `scoring` with archers[0], rendered only if it exists. The text is «DD/MM/YYYY · lugar|Sin lugar».
  - The empty text is the v-else.
- `sortedSessions` (TD/src/stores/sessions.ts:36-40) already gives the AC1 order. No store change.
- Parity source is ScoringView via `useSessionStats(id, archerId)` (TD/src/composables/useSessionStats.ts):
  - `grandTotal` = domain grandTotal;
  - `grandMax` = ends.length × arrowsPerEnd × maxArrowPoints;
  - `average` = averagePerArrow (number|null);
  - a missing face gives 0/0/null;
  - all values are computed.
  - ScoreGrid renders «TOTAL GENERAL: X/max» (testid grand-total) and «Promedio: 9.03» (testid average).
- Catalog: TD/src/domain/targetFaces.ts:63-97 gives each face a Spanish `name` and an `icon` (TargetIcon union, TD/src/domain/types.ts:15-16). Field X=6 and 3D 11 come from zone points.
- `formatDisplayDate` is at TD/src/domain/dates.ts:10-13.
- TargetIcon and SessionCard don't exist yet; the brief names `components/TargetIcon.vue` and `components/SessionCard.vue`. Geometry is at PROJECT_BRIEF.md:238. Decorative SVG precedent: ScoringView.vue:82.
- E2E dependence on the provisional list:
  - e2e/new-session.spec.ts:112-121 asserts the link text `${today} · Sin lugar` and BREAKS;
  - e2e/scoring.spec.ts:139-149 only counts and clicks the single link in the list, and keeps working if ul/li/link stays;
  - offline/install/installability are unaffected.
- 375 px budget:
  - `.app-main` padding 16+16 leaves 343 px;
  - the card spends 2 px border + 24 px padding, leaving 317 px;
  - the icon takes 44 px + 12 px gap, leaving a text column of ≈261 px.
  - `.app-main` overflow-y:auto implies overflow-x auto, and body has overflow-x:hidden, so overflow tests must measure `.app-main` and card geometry (lesson from plan 05).

## Proposed Solution
1. **New TD/src/components/TargetIcon.vue** (production)
   - Prop `icon: TargetIcon`. One root `<svg aria-hidden="true" focusable="false" data-icon=<icon> class="target-icon">`, width/height 100%, `v-if/v-else-if` per value, plain `<circle>`s, no deps.
   - Local constants (English comments): white #FFFFFF, black #000000, blue #00B4E4, red #F65058, yellow #FFE552. These are the brief icon colours, not the keypad colours.
   - Strokes use `vector-effect="non-scaling-stroke"`: the outer outline is 1 px #6b7280 (visible on the light surface and on the dark surface #111827); intermediate lines are 0.5 px.
   - Geometry per icon:
     - **wa-full**: viewBox "-70 -70 140 140".
       - Filled: white 60.9 (outline), black 48.7, blue 36.5, red 24.3, yellow 12.1.
       - Lines: 54.85 (black stroke), 42.65 (white stroke), 30.45, 18.25, 6.05, X 3.045.
     - **wa-reduced**: viewBox "-40 -40 80 80". Blue 36.5 (outline), red 24.3, yellow 12.1; lines 30.45, 18.25, 6.05, 3.045.
     - **wa-triple-vertical**: viewBox "-34 -34 68 68". Three spots at y=-22/0/22, each blue r9.9 (outline), red 7.9, yellow 3.9.
     - **wa-triple-horizontal**: the same, with x=-22/0/22.
     - **wa-field** (simplified): viewBox "-70 -70 140 140". Black r60 (outline), white lines at 48 and 36, yellow r24, black lines at 12 and X 6.
     - **3d** (simplified): viewBox "-40 -40 80 80". Concentric earth/green tones, never WA hexes, each with `data-zone`: 5 = r36 #4d7c0f (outline), 8 = r24 #a16207, 10 = r12 #d97706, 11 = r5 (see amendment 3).
   - Optional `data-ring` attributes on the WA circles for tests.
2. **New TD/src/components/SessionCard.vue** (production)
   - Prop `session: Session`. The parent only renders it when archers[0] exists.
   - Setup:
     - `archer = session.archers[0]!`;
     - `face = getTargetFace(faceId)`;
     - `stats = useSessionStats(session.id, archer.id)`. This is the same path as ScoringView: no new formula, nothing persisted.
     - Props are read once, which is safe because the parent keys by session.id.
   - Computed labels:
     - `dateLabel` = formatDisplayDate(date);
     - `placeLabel` = location.trim() || 'Sin lugar';
     - `distanceLabel` = 0 ? 'Variable' : `${d} m`;
     - `faceName` = face?.name ?? faceId;
     - `structure` = `${seriesCount}×${endsPerSeries}×${arrowsPerEnd}` (U+00D7);
     - `totalLabel` = `Total ${grandTotal}/${grandMax}`;
     - average shown as «Promedio 9.03», or «Promedio —» when null (toFixed(2)).
   - Template:
     - One RouterLink `class="session-card"` to `{name:'scoring', params:{id, archerId}}`, with aria-label «{date}, {place}, {distance}, {faceName}, {structure}, Total {X}/{max}, Promedio {avg}». The prefix matches the AC2 example exactly.
     - Children:
       - `<TargetIcon :icon="face.icon" class="card-icon">` when face exists, otherwise a 44 px placeholder span;
       - `<span class="card-body">` with block spans:
         - `data-testid="card-date-place"` «{date} · {place}» (date nowrap, place truncates with ellipsis);
         - `card-distance-face` «{distance} · {faceName}» (overflow-wrap:anywhere);
         - `card-structure`;
         - `card-totals`: flex-wrap row with column-gap, «Total X/max» and the average span, tabular-nums.
     - No buttons or inputs inside.
   - CSS (scoped, existing tokens only):
     - `.session-card`: grid, 44px minmax(0,1fr), gap var(--space-3), align-items center, min-height var(--touch-min), padding var(--space-3), 1px var(--color-border), var(--radius), var(--color-surface), var(--color-text), no underline.
     - `.card-icon` is 44×44. `.card-body` is min-width 0, flex column, gap 2px.
     - Line 1 is weight 600; lines 2-4 are --color-text-muted at 0.875rem.
     - Focus uses the global `:focus-visible` (tokens.css:88-91). Optional hover border in --color-accent.
3. **Edit TD/src/views/SessionsView.vue** (production)
   - Remove TODO(CU-09). A header comment may note that CU-15 export/import is pending.
   - Add `listedSessions = computed(() => store.sortedSessions.filter(s => s.archers[0] !== undefined))`, which drives both the v-if and the v-for.
   - Keep the h2, the «Nueva sesión» button above, and `<ul class="session-list" aria-label="Sesiones guardadas">`, with each li holding `<SessionCard :session>` `:key="session.id"`.
   - The v-else empty text is unchanged.
   - Drop the `.session-link` style, the RouterLink import and the formatDisplayDate import.
4. No changes to the store, domain, persistence or router. No migration (AC11).

## Files Affected
**Production (developer)**
- TD/src/components/TargetIcon.vue (new)
- TD/src/components/SessionCard.vue (new)
- TD/src/views/SessionsView.vue (edit)

**Tests (QA)**
- TD/src/components/TargetIcon.test.ts (new). One case per icon: data-icon, viewBox, aria-hidden, brief radii and fills, line circles, wa-reduced with no white/black and max r 36.5, triple centres ±22 per axis, field black outer + yellow centre, 3d 4 data-zones with fills outside the WA set, all six distinct.
- TD/src/components/SessionCard.test.ts (new). Pinia seeded via localStorage + makeSession, memory router, strict console spies. Cover:
  - date;
  - trim and «Sin lugar» for empty and whitespace;
  - 18 m and Variable;
  - face name;
  - 2×10×3;
  - WA40 X,9,M → Total 19/600, Promedio 6.33;
  - field 2×12×3 X,6 → 12/432;
  - 3D 2×12×2 11,5 → 16/528;
  - no arrows → 0/600 and «—»;
  - href /session/s1/score/a1;
  - aria-label;
  - no button/input;
  - aria-hidden icon;
  - unknown faceId doesn't throw.
- TD/src/views/SessionsView.test.ts: rewrite the provisional-list describe to cover order via card-date-place, empty text with no ul, legacy «Sesión de prueba», archer-less session omitted (1 li), updates on createSession, «Nueva sesión» first and only button and before the list.
- TD/e2e/new-session.spec.ts:112-121: assert the first card's `card-date-place` toHaveText(`${today} · Sin lugar`), then click as before.
- TD/e2e/scoring.spec.ts:139-149: no change expected; QA verifies.
- TD/e2e/session-list.spec.ts (new, 375 px, strict console tracker):
  - (a) Real flow: session «Club» with Sala 18 m, score X,9,M, read grand-total («TOTAL GENERAL: 19/600») and average («Promedio: 6.33»). Second session: 70 «A»s with no spaces, Variable, «WA 80 cm reducida (6 anillos)». Assert 2 cards in order (second-created first), that the Club card's totals equal the scoring screen's, that the long card shows «Variable · WA 80 cm reducida (6 anillos)», and that clicking Club opens its scoring URL with X/9/M.
  - (b) Fit, for every card: scrollWidth ≤ clientWidth, every descendant's right edge ≤ the card's right, `.app-main` scrollWidth ≤ clientWidth, height ≥ 48, place truncated but boxed inside the card. Tab focus gives `:focus-visible` with a non-none outline.
  - (c) Seeded worst case via addInitScript: wa-122 2×6×12 with 123 X + one 4 → «Total 1234/1440», plus the fit checks.

## Risks (analyst)
- Card average wording «Promedio 9.03» / «Promedio —» follows AC6. It deviates from the Summary's «Promedio: —»; parity is asserted on the numeric value.
- The aria-label extends the AC2 example with structure and totals.
- If every session lacked archers, the empty text would show. Acceptable, since that data shouldn't exist.
- SessionCard depends on Pinia, deliberately, for AC9 parity.
- Wrapping and truncation plus the minmax grid handle wide CI fonts.
- Icon hexes come from the brief geometry, not the keypad colours.
- Coverage is unaffected. No deps, no data changes.
- Untouched: CU-10/08/11/12/15/16.

## Challenger amendments (Minor; binding for the developer/QA, no re-review needed)
1. **Ellipsis on a flex line.** `card-date-place` must be `display:flex; min-width:0`. The date span is `flex:none; white-space:nowrap`. The place span is `flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`. An inline span alone will not truncate. QA asserts the place span's computed text-overflow is ellipsis and its box stays inside the card.
2. **No dangling «·» on wrap.** In `card-totals`, put the «·» separator where a wrapped average line can't start with it (e.g. a separator span hidden on wrap, or margin-based spacing without the dot). Cosmetic; the developer's choice.
3. **3D centre colour.** The 3D zone-11 centre must not be a yellow close to WA #FFE552; replace #fde68a with a non-yellow tone (e.g. cream #fef3c7 or a light green). The unit test asserts that no 3D fill is in the WA hex set.
4. **Record the label decision in PLAN_FILE.** The card's «Promedio 9.03» / «Promedio —» is intended, per AC6. (Done: see the orchestrator note at the top.)
5. **Prefer the testid assertion.** new-session.spec uses the `card-date-place` toHaveText assertion, not an accessible-name prefix.
