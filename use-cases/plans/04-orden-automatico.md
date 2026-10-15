---
plan_for: use-cases/04-orden-automatico.md
work_branch: feat/uc-04-orden-automatico
run: arco-entrenamiento-uc-4
approved: 2026-10-15
---

UC04 (arco-entrenamiento-uc-4) is approved in round 1. Below are the full approved proposal and the challenger verdict.

## VERDICT: Approve
I checked the code citations against the worktree and they are accurate: sessions.ts setArrow L79–85, useScoring.score L33–38, sessions.test L152–165 and L270–274, useScoring.test L185–200 and L242–251, and the e2e comment at L230. A grep of the e2e and view tests confirms that every other end they complete is already sorted (X,9,M / X,7,M / X,9,8), so no other existing assertion breaks.
Minor notes, both non-blocking:
(1) The AC10 e2e correction taps the last column (0,2). That cell always wraps to (1,0), so it does not show AC6 in e2e. Optionally also correct a non-last cell whose value moves, e.g. tap (0,0) on ['X','7','M'] and score '9' → ['9','7','M'] sorted, with selection (0,1).
(2) tsconfig.app.json inherits lib from @vue/tsconfig, so use copy + sort and do not use toSorted.

## APPROVED PROPOSAL (v1, analyst-uc4, verbatim)

TD = /Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-04-orden-automatico

### Analysis
- Frontmatter: Vue 3.5 + Pinia + TS, Vitest (jsdom) + Playwright (375 px). profiles: [] (no profile skills to load). The 90% line coverage gate applies to src/domain/** and src/composables/**. Developer owns paths.production except src/**/*.test.ts. QA owns src/**/*.test.ts, tests/**, e2e/**.
- TD/src/domain/types.ts: End = (string|null)[]. ScoringZone.order is the best-to-worst rank (L9-10).
- TD/src/domain/targetFaces.ts: zones are built best-to-worst with order = index (L40-49). WA: X,10..lowest,M. wa-field: X,6,5,4,3,2,1,M. 3d: 11,10,8,5,M. So the AC2 expectations match the catalog: WA 40 gives X,10,7,M. 3D gives 11,8,5,M. Field gives X,6,3.
- TD/src/domain/scoring.ts: pure functions zonePoints, firstEmptyCell, nextCell. There is no sortEnd yet.
- TD/src/stores/sessions.ts setArrow (L71-87): early return if the session is missing or closed (covers AC8). It validates row and arrow. A non-null key must be on the face (getTargetFace(...).zones, L82). Then `end[arrow] = key`, with the TODO(CU-06) hook at L84-85. deleteEnd (L90-99) nulls in place, and a store test pins array identity (sessions.test.ts L255-261). Persistence is a deep watch on sessions (L101-107), so any in-place mutation inside setArrow is saved together with the write.
- TD/src/composables/useScoring.ts score() (L33-38): calls store.setArrow(row, col) and then `selected = nextCell(selected.value, ends)`. The selection is computed from the touched (row, col), never from where the value ends up, so AC6 already holds with no change to useScoring.
- TD/src/components/ScoreGrid.vue L60-76: cells use v-for over ends[row] with :key="col" (an index key). A re-sort therefore just re-renders the text of the same cell elements. No element moves, and there is no <Transition>/<TransitionGroup>. A grep of src/ and index.html finds no CSS transition or animation. AC7 holds with no UI change.
- TD/src/composables/usePersistence.ts L35 only checks that each end value is null or a string. It does not check keys against the face, so a hydrated end could contain a key that is not on the face. sortEnd must tolerate that.

### Proposed Solution
1. TD/src/domain/scoring.ts: add and export the pure function `sortEnd(end: End, face: TargetFace): End`.
   - It returns a NEW array and never mutates the input. Use a copy, then sort. Array.prototype.sort is stable (ES2019+), so equal keys keep their relative order. Do not use toSorted (challenger: the app tsconfig inherits lib from @vue/tsconfig).
   - The sort key is the zone's `order` field, looked up by key on the given face. Build a key→order map once per call (do not use indexOf on the zones array or compare key text). Non-null keys sort by ascending order. A non-null key that is not on the face sorts after all known keys and before nulls. This is defensive and stable, and covers hydrated data. Nulls go last, in place of their original slots.
   - Add a doc comment in the file's existing style: "Best-to-worst by zone order; empties last. Pure, stable."
2. TD/src/stores/sessions.ts setArrow: replace the TODO(CU-06) comment with the behaviour.
   - After `end[arrow] = key`, the end is sorted only when key !== null and the end now has no null (`!end.includes(null)`). The face is already resolved for non-null keys, so keep the result of getTargetFace from the L82 validation in a local instead of looking it up twice.
   - Write the sorted result back IN PLACE (index assignment over the same array) so the end array's identity is kept. That is consistent with deleteEnd and the deep watch, and it means one persisted save holds the sorted end (AC3/AC4).
   - This one condition covers both "filling the last empty arrow", including when the last gap filled is in the middle (out-of-order scoring), and "overwriting an arrow of an already complete end" (AC3, AC4). A null write never satisfies it, so deleting from a complete end leaves the gap with no reorder (AC5). The closed-session early return stays first (AC8). deleteEnd is unchanged.
   - Keep the comment: a null write never completes an end, so deleting an arrow never sorts.
3. No changes to useScoring, ScoreGrid, ScoreCell or ScoringView. AC6 and AC7 already hold structurally. Optional, owned by the developer: a one-line comment above the nextCell call in useScoring.score, "Advance from the touched cell even if CU-06 sorting moved its value". It has no behaviour change.
4. No data migration and no persistence version bump. Complete ends that were stored unsorted before CU-06 stay as they are until they are next corrected, and then they sort.

### Files Affected
- **Production code** (developer):
  - TD/src/domain/scoring.ts: new sortEnd.
  - TD/src/stores/sessions.ts: sorting in setArrow, replacing TODO(CU-06).
  - (optional comment only) TD/src/composables/useScoring.ts.
- **Test code** (qa):
  - TD/src/domain/scoring.test.ts: a new describe('sortEnd'):
    - The AC2 cases: wa-40 ['7','M','X','10'] → ['X','10','7','M']; 3d ['5','11','M','8'] → ['11','8','5','M']; wa-field ['3','X','6'] → ['X','6','3'].
    - Nulls last: [null,'7','X'] → ['X','7',null].
    - The input is not mutated, and a new array reference is returned.
    - Stability: use a custom face fixture with zones A(order 0) and B(order 0); input ['B','A'] → ['B','A']. Also ['9','X','9'] → ['X','9','9'].
    - The sort follows `order`, not key text: ['M','X','1'] → ['X','1','M'] on wa-40. Also a custom face whose order is the reverse of its text order.
    - An unknown key goes after known keys and before nulls.
    - An empty end returns [].
  - TD/src/stores/sessions.test.ts:
    - CHANGE L152-165: ['X','2','8'] must now be ['X','8','2'] in both memory and storage. Rename it to "...re-sorts and persists sorted" (AC4). End 1 ['7',null,null] still asserts an incomplete end is not sorted.
    - ADD: completing an end out of order sorts it and persists it sorted (AC3): write '7','M','X' → ['X','7','M'] in store and localStorage. Also fill a middle gap last: ['8',null,'X'] then write '9' at col 1 → ['X','9','8'].
    - ADD: writes to an incomplete end never reorder: '7','X' in cols 0 and 1 of a 3-arrow end stays ['7','X',null].
    - ADD: the end array identity is preserved after sorting.
    - ADD: a 3d face completion that sorts.
    - KEEP L270-274 (setArrow(null) on a complete end leaves a gap and does not reorder, AC5). Optionally strengthen it with an unsorted seed: seed ['8','X','9'], then null col 0 → [null,'X','9'].
    - KEEP the closed no-op tests (AC8). Optionally add a closed session seeded with an unsorted complete end: setArrow(non-null) → unchanged and unsorted.
  - TD/src/composables/useScoring.test.ts:
    - CHANGE L185-192: ['X','7','8'] becomes ['X','8','7']. The selection stays at (0,2) (AC6).
    - CHANGE L194-200: ['1','9','8'] becomes ['9','8','1']. Rename it and assert the selection is (0,1), which is nextCell of the touched (0,0) (AC6 core).
    - CHANGE L242-251: the stored value ['X','6','8'] becomes ['X','8','6'].
    - ADD: seed ['X','9','8'], select (0,2), score '10' → ['X','10','9'], selection (1,0).
    - KEEP L392-399 (deleteArrow leaves a gap, AC5) and L383-390 (refill after a delete).
  - TD/src/views/ScoringView.test.ts: no change required. Optionally add a check that completing 7, M, X renders X / 7 / M with selection 1-0.
  - TD/e2e/scoring.spec.ts:
    - L217-239: the assertions stay valid. Update the comment at L230 "No re-sorting of the end (CU-06)" (e.g. "X 7 M is already in order").
    - ADD the AC10 test at 375 px: score 7, M, X → row 0 ['X','7','M'], stored ['X','7','M'], selection (1,0). Tap (0,2) and score 10 → ['X','10','7'], selection (1,0). Reload → ['X','10','7'] is kept. Assert no console problems. Assert the cell texts right after the click, with no animation wait. Optionally assert the computed transition-duration is 0s. (Challenger, optional: also correct a non-last cell whose value moves, to show AC6 in e2e.)
- USE_CASES.md and the brief are not touched by agents.

### Risks & Considerations
- R1 Legacy unsorted complete ends: no migration. They sort on the next correction. Hydration must NOT sort.
- R2 Selection after a re-sort (AC6) is intended to land on a cell with a different value. QA pins it.
- R3 Write back in place rather than replacing the array, for identity consistency with deleteEnd.
- R4 Unknown hydrated keys are handled defensively by sortEnd.
- R5 The face is always resolved before sorting is reached. There is no new failure mode.
- R6 Stable sort, as AC1 requires.
- R7 Out of scope: CU-07 totals, a sort toggle, sorting incomplete ends.
- R8 Coverage of ≥90% is maintained (sortEnd plus one new branch, both covered).
- R9 No new deps. The AC11 commands are unchanged.
