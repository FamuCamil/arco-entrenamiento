---
plan_for: use-cases/11-copia-seguridad.md
work_branch: feat/uc-11-copia-seguridad
run: arco-entrenamiento-uc-11
team: [analyst-uc11, challenger-uc11, developer-uc11, qa-uc11]
approved: 2026-10-17
---

UC-11 (arco-entrenamiento-uc-11) is approved by challenger-uc11 after 2 rounds. The full approved proposal follows.

## Verdict
Approved. v1 had 2 Major issues:
- the status notice wouldn't reliably be announced, because it was inserted with v-if;
- a newer-version file whose sessions were restructured got the wrong message, because the sessions check came before the version check.

v2 fixes both and adopts the 3 Minor recommendations: the canShare try/catch, saving a profile-only change, and scoping the existing tests to `.new-session`.

Accepted deviation from the orchestrator's review point "zone keys valid for the face": import uses exactly load()'s rules, so an unknown faceId or key passes. I verified this is safe. zonePoints scores an unknown key as 0, sortEnd tolerates unknown keys, and useScoring, useSessionStats and SessionCard handle `getTargetFace(...) === undefined`. AC7 doesn't require it, and tightening load() is out of scope.

## Approved proposal (analyst-uc11 v1 + v2, merged)
All paths are under TARGET_DIR=/Users/deebryl/Documents/Proyectos/arco-entrenamiento-uc-11-copia-seguridad.

### Proposed Solution

**1. New `src/domain/persistedState.ts` (pure).**
- Move these from usePersistence.ts unchanged: isRecord, isNonNegativeInt, isPositiveInt, isArcher, isSession, isPersistedState, migrate.
- Add `export const CURRENT_VERSION = 1`.
- Export isRecord, isSession, isPersistedState, migrate and CURRENT_VERSION.
- usePersistence.ts imports them and re-exports `migrate`. The usePersistence() return shape and load/save behaviour are identical, and the existing usePersistence.test.ts must pass unchanged.
- usePersistence keeps its header comment and gets one added line: the schema rules live in domain/persistedState and are shared with backup import.

**2. New `src/domain/backup.ts` (pure, no Vue/DOM).**
- `BACKUP_MIME = 'application/json'`, and `BackupFile extends PersistedState { exportedAt: string }`.
- `serializeBackup(state, now)` returns JSON.stringify of `{version, sessions, profileName, exportedAt: now.toISOString()}`, built field by field, with a 2-space indent and keys in that order.
- `backupFileName(now)` returns `arco-copia-${localIsoDate(now)}.json` (from src/domain/dates.ts).
- `parseBackup(text)` returns `{ok:true, state:{version:1, sessions, profileName}}` or `{ok:false, error}`. The checks run in this order, and the messages are exported constants (`IMPORT_ERRORS`):
  - (a) JSON.parse fails: «El archivo no es una copia válida: no contiene JSON.»
  - (b) `!isRecord(raw)`: «El archivo no es una copia de Arco · Entrenamientos.»
  - (c) `typeof raw.version === 'number' && raw.version > CURRENT_VERSION`: «La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.»
  - (d) `!Array.isArray(raw.sessions)`: the same not-a-copy message as (b).
  - (e) `migrate(raw) === null`: «La copia tiene una versión desconocida.»
  - (f) `!isPersistedState(migrated)`: «La copia tiene sesiones dañadas o incompletas. No se ha importado nada.»
  - (g) Duplicate session ids are rejected: «La copia tiene sesiones repetidas. No se ha importado nada.»
  - `exportedAt` is optional and dropped, so a raw `archery-training:v1` dump also imports.
- `planMerge(local, incoming)` returns `{sessions, added, updated, unchanged}`. It is pure and never mutates its inputs:
  - Local sessions keep their order. When the incoming `updatedAt` is strictly greater, the incoming object replaces the local one (updated). Otherwise the local object is kept by reference (unchanged); a tie keeps local.
  - New ids are appended in file order (added).
  - Local-only sessions are kept. Imported objects keep their closed, createdAt and updatedAt as they came.
- Message builders (singular only when n === 1):
  - `importConfirmMessage(counts)`, e.g. «Se añadirán 3 sesiones y se actualizará 1. 5 ya están al día.» When added === 0, the change clause is «Se actualizará 1 sesión» / «Se actualizarán N sesiones».
  - `importSuccessMessage(counts)`: «Copia importada: {a} sesión añadida|sesiones añadidas, {u} actualizada|actualizadas y {n} sin cambios.» Zero uses the plural.
  - `IMPORT_NO_CHANGES`: «La copia no tiene cambios: todas las sesiones ya están al día.»
  - `IMPORT_EMPTY`: «La copia no contiene sesiones.»

**3. Store (`src/stores/sessions.ts`).**
- `exportJson(now = new Date())` returns `serializeBackup({version:1, sessions, profileName}, now)`. It works with 0 sessions.
- `importJson(text): ImportPreview` never mutates. It returns either `{ok:false, error}` or `{ok:true, total, added, updated, unchanged, apply}`.
- `apply()` does the following:
  - It re-runs planMerge against the current sessions.value.
  - If added + updated > 0, it assigns sessions.value once.
  - It adopts the file's profileName only if the local one is blank (trim) and the file's is non-empty.
  - It sets `changed = added + updated > 0 || profileAdopted`. When changed is true, it calls `save()` explicitly and returns the result as `saved`; otherwise `saved: true`. The deep watch also saves, which is a harmless duplicate.
  - It returns `{added, updated, unchanged, saved}`.
- Export both actions and the ImportPreview type.

**4. `SessionsView.vue`.**
- Update the line-2 comment.
- After the ul or `.empty` text, inside the root section, add `<section class="backup" aria-labelledby="backup-title" data-testid="backup-section">`. It renders in the empty state too, with margin-top `--space-6` and `position: relative`, and «Nueva sesión» doesn't move.
- Inside it:
  - `<h3 id="backup-title">Copia de seguridad</h3>`.
  - A two-column grid (gap `--space-2`) of `type="button"` buttons: «Exportar copia» (`data-testid="export-backup"`, ref exportButton) and «Importar copia» (`data-testid="import-backup"`, ref importButton).
  - Button style is ScoringView's outlined accent `.close-session`: min-height `--touch-min`, a 1px accent border, surface background, accent text, weight 600, `touch-action: manipulation`, `white-space: normal`, `min-width: 0`, and no danger colour.
- Export is disabled when there are 0 sessions (the AC5 choice). This uses the ScoreActions pattern: `aria-disabled="true"` plus a handler guard, with opacity .5 and cursor not-allowed.
- A hidden `<input ref="fileInput" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" data-testid="import-input" @change="onFileChosen">`. It is visually hidden rather than `display:none`: absolute, 1px, opacity 0, `clip-path: inset(50%)`, overflow hidden, pointer-events none.
- **Live regions** are always in the DOM below the buttons:
  - `<div class="notice-region" role="status" aria-live="polite" data-testid="backup-status">` holds success/info notices.
  - `<div class="notice-region" role="alert" data-testid="backup-alert">` holds error notices.
  - Inside each, `<div v-if class="notice notice-{kind}" data-testid="backup-notice">` contains a `<p>` (`overflow-wrap: anywhere`, flex 1, min-width 0) and a «×» close button (`aria-label="Cerrar aviso"`, `data-testid="backup-notice-close"`, 48×48).
  - `.notice-region` has no box styling of its own. `.notice` gets a flex row, a 1px border, a surface-raised background, and a 4px left border in accent, or `--color-danger` for errors.
  - The notice is cleared by its close button, at the start of each export or import click, and on unmount.
- **onExport** is synchronous up to the share call:
  - Return on the disabled guard, and clear the notice.
  - Build `now`, then `new File([store.exportJson(now)], backupFileName(now), {type: BACKUP_MIME})`.
  - `canShareFile` is computed inside try/catch; a throw counts as false.
  - If it's true, call `navigator.share({files:[file], title:'Copia de seguridad de Arco · Entrenamientos'})` with no await before it. `.catch` ignores AbortError and calls downloadFile on any other error. If it's false, call downloadFile.
  - downloadFile: createObjectURL, a hidden `<a download>` appended to body, click, remove, then `setTimeout(revokeObjectURL, 1000)`.
  - Any throw becomes the error notice «No se pudo exportar la copia.» There is no success notice on export.
- **onImportClick** clears the notice and calls `fileInput.click()`.
- **onFileChosen:**
  - Take the file, immediately set `input.value = ''`, and return if there is no file.
  - `await file.text()` in try/catch, with error «No se pudo leer el archivo.»
  - `preview = store.importJson(text)`, validated by content and never by MIME. If it isn't ok, show an error notice and nothing changes.
  - If total === 0: call apply(), then show the info notice IMPORT_EMPTY, or the storage warning if `saved` is false.
  - Else if added + updated === 0: call apply(), then show the info notice IMPORT_NO_CHANGES, or the storage warning if `saved` is false. No dialog.
  - Otherwise `await confirm({title:'¿Importar copia?', message: importConfirmMessage(preview), confirmLabel:'Importar', cancelLabel:'Cancelar', danger:false, returnFocusTo: importButton})`.
    - On false, nothing changes.
    - On true, `r = apply()`. If `r.saved`, show the success notice importSuccessMessage(r). Otherwise show the error «Las sesiones se han importado, pero no se pudieron guardar en el dispositivo. Podrían perderse al cerrar la app.»
  - Cards re-render through sortedSessions.

**5. No other production changes and no new dependencies.**

### AC coverage
- AC1: item 4.
- AC2: serializeBackup, backupFileName, the MIME constant, and the round-trip test.
- AC3/AC4: onExport and downloadFile.
- AC5: export disabled, with exportJson still tested at 0 sessions.
- AC6: the accept attribute and the input reset.
- AC7: parseBackup reusing the moved predicates.
- AC8: planMerge.
- AC9: confirm with danger false, returnFocusTo, and the no-changes info notice.
- AC10: apply's single assignment and save, and the persistent live regions.
- AC11: the profileName rule; imported objects are kept as-is.
- AC12/AC13: tests below.

### Files
- **Production:**
  - src/domain/persistedState.ts (new)
  - src/domain/backup.ts (new)
  - src/composables/usePersistence.ts
  - src/stores/sessions.ts
  - src/views/SessionsView.vue
- **Tests:**
  - src/domain/backup.test.ts (new)
  - src/domain/persistedState.test.ts (new)
  - src/stores/sessions.test.ts
  - src/views/SessionsView.test.ts
  - e2e/backup.spec.ts (new)

### Tests

**backup.test.ts:**
- serializeBackup's key order, indent and ISO exportedAt.
- backupFileName in local time near midnight: `new Date(2026,9,17,23,59)` gives 2026-10-17.
- A round trip deep-equals the state.
- parseBackup rejects each of:
  - non-JSON;
  - an array, a string or null;
  - a missing sessions array;
  - `{version:2, data:[]}`, which must give the newer-version message;
  - `{version:1, data:[]}`, which must give the not-a-copy message;
  - version 2, version 0, and a missing version;
  - a missing field;
  - a wrong type;
  - ends length ≠ rows;
  - end length ≠ arrowsPerEnd;
  - empty archers;
  - duplicate ids.
- A valid file without exportedAt is accepted.
- planMerge: add; update; a tie keeps local; older keeps local; local-only sessions are kept; inputs aren't mutated; idempotence; closed, createdAt and updatedAt are preserved.
- Every message builder in singular, plural and zero forms, including the exact AC example.

**persistedState.test.ts:** migrate and isPersistedState tested directly.

**sessions.test.ts** (`describe('exportJson / importJson')`):
- Export with and without sessions.
- importJson doesn't mutate before apply.
- apply adds, updates and keeps; it persists to STORAGE_KEY with `saved: true`; the array order is locals then added.
- profileName: an empty local adopts the file's name, a non-empty local is kept.
- A profile-only adoption with all sessions up to date persists the name with `saved: true`.
- setItem throwing a QuotaExceededError gives `saved: false`, both in the merge path and in the profile-only path.
- Invalid text gives `ok:false`, and the state is unchanged.

**SessionsView.test.ts:**
- Change the existing assertions at :61-67, :78-82 and :158 to scope to `.new-session`.
- New tests, mounted with attachTo body:
  - The section, heading and testids, after the list, including in the empty state. Both live regions exist while empty.
  - Export is aria-disabled with 0 sessions, and a click is a no-op.
  - Share available: share is called with one File of the right name and type plus the title, and no download happens.
  - AbortError: no notice and no download.
  - Another share error: falls back to download.
  - canShare throws TypeError: download, share not called, no console output.
  - No canShare: download.
    - URL.createObjectURL and revokeObjectURL are stubbed with defineProperty.
    - `HTMLAnchorElement.prototype.click` is spied with an implementation, so jsdom doesn't log a navigation error.
    - `a.download` is asserted, and revoke runs after advancing fake timers by 1000.
  - Import uses defineProperty `files` on the input, then trigger('change'), then flushPromises:
    - Valid file with changes: the dialog has the exact title, message and labels and the is-safe class, and window.confirm is never called. Accepting applies; the cards and the success text appear inside `backup-status`.
    - Cancel and Escape: nothing changes, and focus returns to «Importar copia».
    - No changes: no dialog, and the info notice in `backup-status`.
    - Invalid file: the exact message inside `backup-alert`, and the store is unchanged.
    - The input value is cleared after change.
    - The close button removes the notice, and the next click clears it.
- Navigator props are restored in afterEach.

**e2e/backup.spec.ts** (375×740, with a trackConsole that must stay empty):
- addInitScript deletes `Navigator.prototype.share` and `canShare`.
- Steps:
  1. Create 2 sessions through the real flow, score one end in one of them, and record both cards' aria-labels.
  2. Capture the download with `waitForEvent('download')`. The filename matches `^arco-copia-\d{4}-\d{2}-\d{2}\.json$`, and the content read with fs is version 1, 2 sessions, exportedAt present, indented.
  3. `localStorage.clear()`, then reload. The empty text shows and export is aria-disabled.
  4. setInputFiles with the downloaded file. The dialog message contains «2 sesiones», then «Importar». The cards return with the same aria-labels, and getByRole('status') inside the section shows the result.
  5. Import again: «al día» appears in the status region, and no dialog opens.
  6. An invalid buffer: getByRole('alert') shows, and the card count is unchanged.
  7. Fit at 375 px: the documentElement and `.app-main` have no horizontal overflow; both buttons and the notice sit within 0..375 and are ≥48 px tall; «Nueva sesión»'s bounding box is unchanged. Also run the fit in the empty state.
- Existing specs need no change. offline.spec keeps retries 0 and its console guards.

### Risks
- The move into persistedState must keep the rules byte-for-byte the same. usePersistence.test.ts is the guard.
- Shared load() rules mean an unknown faceId or key passes. This is verified safe at runtime, as noted above.
- iOS: when share fails with something other than AbortError, the fallback download runs outside the gesture. Verify on a real iPhone.
- The 1000 ms revoke delay is a deliberate Safari margin.
- The explicit save plus the deep watch is a double save, which is harmless.
- No cross-tab sync, as in CU-10. apply re-plans, so the counts in the success notice are the actual ones.
- CI fonts: button text wraps and notice text uses `overflow-wrap: anywhere`.
- The new domain files have full unit tests, so coverage stays ≥90 %.
- No new dependencies.
