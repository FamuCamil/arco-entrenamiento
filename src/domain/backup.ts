import { localIsoDate } from '@/domain/dates'
import { CURRENT_VERSION, isPersistedState, isRecord, migrate } from '@/domain/persistedState'
import type { PersistedState, Session } from '@/domain/types'

// Backup export/import (CU-11). Pure: no Vue, DOM or storage. Import accepts exactly what
// load() accepts (shared predicates in domain/persistedState) and never trusts the MIME type.

export const BACKUP_MIME = 'application/json'

export interface BackupFile extends PersistedState {
  /** ISO 8601 (UTC) instant of the export. Informational; ignored on import. */
  exportedAt: string
}

export const IMPORT_ERRORS = {
  notJson: 'El archivo no es una copia válida: no contiene JSON.',
  notACopy: 'El archivo no es una copia de Arco · Entrenamientos.',
  newerVersion:
    'La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.',
  unknownVersion: 'La copia tiene una versión desconocida.',
  invalidSessions: 'La copia tiene sesiones dañadas o incompletas. No se ha importado nada.',
  duplicateIds: 'La copia tiene sesiones repetidas. No se ha importado nada.',
} as const

export const IMPORT_NO_CHANGES = 'La copia no tiene cambios: todas las sesiones ya están al día.'
export const IMPORT_EMPTY = 'La copia no contiene sesiones.'

/** Pretty-printed backup JSON; keys in a fixed order: version, sessions, profileName, exportedAt. */
export function serializeBackup(state: PersistedState, now: Date): string {
  const file: BackupFile = {
    version: state.version,
    sessions: state.sessions,
    profileName: state.profileName,
    exportedAt: now.toISOString(),
  }
  return JSON.stringify(file, null, 2)
}

/** `arco-copia-YYYY-MM-DD.json`, with the local date. */
export function backupFileName(now: Date): string {
  return `arco-copia-${localIsoDate(now)}.json`
}

export type ParseResult = { ok: true; state: PersistedState } | { ok: false; error: string }

/** Validates a backup's text. All or nothing: any invalid session rejects the whole file. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: IMPORT_ERRORS.notJson }
  }
  if (!isRecord(raw)) return { ok: false, error: IMPORT_ERRORS.notACopy }
  // Checked before the shape: a newer version may have restructured its sessions.
  if (typeof raw.version === 'number' && raw.version > CURRENT_VERSION) {
    return { ok: false, error: IMPORT_ERRORS.newerVersion }
  }
  if (!Array.isArray(raw.sessions)) return { ok: false, error: IMPORT_ERRORS.notACopy }
  const migrated = migrate(raw)
  if (migrated === null) return { ok: false, error: IMPORT_ERRORS.unknownVersion }
  if (!isPersistedState(migrated)) return { ok: false, error: IMPORT_ERRORS.invalidSessions }
  const ids = new Set(migrated.sessions.map((s) => s.id))
  if (ids.size !== migrated.sessions.length) return { ok: false, error: IMPORT_ERRORS.duplicateIds }
  return {
    ok: true,
    state: { version: 1, sessions: migrated.sessions, profileName: migrated.profileName },
  }
}

export interface MergeCounts {
  added: number
  updated: number
  unchanged: number
}

export interface MergePlan extends MergeCounts {
  sessions: Session[]
}

/**
 * Merges by session id without mutating either input. Local order is kept; an incoming session
 * replaces the local one only when its updatedAt is strictly newer (a tie keeps local). New ids
 * are appended in file order, and local-only sessions are kept.
 */
export function planMerge(local: readonly Session[], incoming: readonly Session[]): MergePlan {
  const byId = new Map(incoming.map((s) => [s.id, s]))
  let updated = 0
  let unchanged = 0
  const sessions = local.map((current) => {
    const other = byId.get(current.id)
    if (!other) return current
    if (other.updatedAt > current.updatedAt) {
      updated++
      return other
    }
    unchanged++
    return current
  })
  const localIds = new Set(local.map((s) => s.id))
  const fresh = incoming.filter((s) => !localIds.has(s.id))
  return { sessions: [...sessions, ...fresh], added: fresh.length, updated, unchanged }
}

function sessions(n: number): string {
  return n === 1 ? '1 sesión' : `${n} sesiones`
}

/** e.g. «Se añadirán 3 sesiones y se actualizará 1. 5 ya están al día.» */
export function importConfirmMessage({ added, updated, unchanged }: MergeCounts): string {
  let change: string
  if (added === 0) {
    change = `${updated === 1 ? 'Se actualizará' : 'Se actualizarán'} ${sessions(updated)}`
  } else {
    change = `${added === 1 ? 'Se añadirá' : 'Se añadirán'} ${sessions(added)}`
    if (updated > 0)
      change += ` y ${updated === 1 ? 'se actualizará' : 'se actualizarán'} ${updated}`
  }
  const rest =
    unchanged === 0 ? '' : ` ${unchanged} ${unchanged === 1 ? 'ya está' : 'ya están'} al día.`
  return `${change}.${rest}`
}

/** «Copia importada: 2 sesiones añadidas, 1 actualizada y 0 sin cambios.» */
export function importSuccessMessage({ added, updated, unchanged }: MergeCounts): string {
  const a = added === 1 ? '1 sesión añadida' : `${added} sesiones añadidas`
  const u = updated === 1 ? '1 actualizada' : `${updated} actualizadas`
  return `Copia importada: ${a}, ${u} y ${unchanged} sin cambios.`
}
