import type { Archer, PersistedState, Session } from '@/domain/types'

// The only module that touches localStorage (brief D1). Restored contents are untrusted:
// they are migrated and validated before use, and anything invalid yields the empty state.

export const STORAGE_KEY = 'archery-training:v1'
/** Unreadable raw contents are copied here so they are never silently lost. */
export const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`

export function emptyState(): PersistedState {
  return { version: 1, sessions: [], profileName: '' }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isPositiveInt(v: unknown): v is number {
  return isNonNegativeInt(v) && v > 0
}

function isArcher(v: unknown, rows: number, arrows: number): v is Archer {
  if (!isRecord(v)) return false
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return false
  if (!['A', 'B', 'C', 'D'].includes(v.position as string)) return false
  if (!Array.isArray(v.ends) || v.ends.length !== rows) return false
  return v.ends.every(
    (end) =>
      Array.isArray(end) &&
      end.length === arrows &&
      end.every((key) => key === null || typeof key === 'string'),
  )
}

function isSession(v: unknown): v is Session {
  if (!isRecord(v)) return false
  const strings = ['id', 'date', 'location', 'faceId', 'notes'] as const
  if (!strings.every((k) => typeof v[k] === 'string')) return false
  if (typeof v.distance !== 'number' || !Number.isFinite(v.distance) || v.distance < 0) return false
  if (!isPositiveInt(v.seriesCount) || !isPositiveInt(v.endsPerSeries)) return false
  if (!isPositiveInt(v.arrowsPerEnd)) return false
  if (typeof v.closed !== 'boolean') return false
  if (!isNonNegativeInt(v.createdAt) || !isNonNegativeInt(v.updatedAt)) return false
  const rows = v.seriesCount * v.endsPerSeries
  const arrows = v.arrowsPerEnd
  return (
    Array.isArray(v.archers) &&
    v.archers.length > 0 &&
    v.archers.every((a) => isArcher(a, rows, arrows))
  )
}

function isPersistedState(v: unknown): v is PersistedState {
  return (
    isRecord(v) &&
    v.version === 1 &&
    typeof v.profileName === 'string' &&
    Array.isArray(v.sessions) &&
    v.sessions.every(isSession)
  )
}

/**
 * Migrations entry point: brings any known older schema up to the current version.
 * Returns null for an unknown or missing version (treated as corrupt).
 */
export function migrate(raw: unknown): unknown {
  if (!isRecord(raw)) return null
  switch (raw.version) {
    case 1:
      return raw
    default:
      return null
  }
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function preserveCorrupt(storage: Storage, raw: string): void {
  try {
    storage.setItem(CORRUPT_KEY, raw)
  } catch {
    // Nothing more we can do; the original key is left untouched until the next save.
  }
}

/** Loads the persisted state, or the empty state if storage is unavailable or invalid. */
export function load(): PersistedState {
  const storage = getStorage()
  if (!storage) return emptyState()
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return emptyState()
  }
  if (raw === null) return emptyState()
  try {
    const state = migrate(JSON.parse(raw))
    if (isPersistedState(state)) return state
  } catch {
    // Invalid JSON: fall through to the corrupt path.
  }
  preserveCorrupt(storage, raw)
  return emptyState()
}

/** Saves the state. Returns false (never throws) when storage is unavailable or full. */
export function save(state: PersistedState): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/** Asks the browser not to evict our storage. Tolerates a missing API or a rejection. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function') {
      await navigator.storage.persist()
    }
  } catch {
    // Best effort only.
  }
}

export function usePersistence() {
  return { load, save, migrate, requestPersistentStorage }
}
