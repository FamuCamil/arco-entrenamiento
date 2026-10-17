import type { Archer, PersistedState, Session } from '@/domain/types'

// Schema rules for the persisted state (pure). Shared by usePersistence's load() and by backup
// import (CU-11), so both accept exactly the same data.

export const CURRENT_VERSION = 1

export function isRecord(v: unknown): v is Record<string, unknown> {
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

export function isSession(v: unknown): v is Session {
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

export function isPersistedState(v: unknown): v is PersistedState {
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
