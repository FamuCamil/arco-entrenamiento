import { isPersistedState, migrate } from '@/domain/persistedState'
import type { PersistedState } from '@/domain/types'

export { migrate }

// The only module that touches localStorage (brief D1). Restored contents are untrusted:
// they are migrated and validated before use, and anything invalid yields the empty state.
// The schema rules live in domain/persistedState and are shared with backup import (CU-11).

export const STORAGE_KEY = 'archery-training:v1'
/** Unreadable raw contents are copied here so they are never silently lost. */
export const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`

export function emptyState(): PersistedState {
  return { version: 1, sessions: [], profileName: '' }
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
