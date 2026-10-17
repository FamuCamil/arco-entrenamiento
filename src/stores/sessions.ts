import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { usePersistence } from '@/composables/usePersistence'
import { parseBackup, planMerge, serializeBackup } from '@/domain/backup'
import { createId } from '@/domain/ids'
import { hasAnyArrow, sortEnd } from '@/domain/scoring'
import { getTargetFace } from '@/domain/targetFaces'
import type { Archer, End, Session } from '@/domain/types'

/** CU-21 will replace this with the profile name. */
export const DEFAULT_ARCHER_NAME = 'Yo'

export interface SessionInput {
  date: string
  location: string
  distance: number
  faceId: string
  seriesCount: number
  endsPerSeries: number
  arrowsPerEnd: number
  notes?: string
}

/** Fields updateSession may change (CU-11); a missing key leaves that field as it is. */
export type SessionPatch = Partial<SessionInput>

/** Result of importJson: either the parse error, or the merge counts plus a way to apply it. */
export type ImportPreview =
  | { ok: false; error: string }
  | {
      ok: true
      /** Sessions in the file. */
      total: number
      added: number
      updated: number
      unchanged: number
      apply: () => ImportResult
    }

export interface ImportResult {
  added: number
  updated: number
  unchanged: number
  /** False when the merged state could not be written to storage. */
  saved: boolean
}

function emptyEnds(rows: number, arrows: number): End[] {
  return Array.from({ length: rows }, () => Array.from({ length: arrows }, () => null))
}

export const useSessionsStore = defineStore('sessions', () => {
  const { load, save } = usePersistence()
  const initial = load()

  const sessions = ref<Session[]>(initial.sessions)
  const profileName = ref(initial.profileName)

  /** Newest first: date descending, then createdAt descending. Never reorders `sessions`. */
  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
    ),
  )

  function getSession(id: string): Session | undefined {
    return sessions.value.find((s) => s.id === id)
  }

  function getArcher(sessionId: string, archerId: string): Archer | undefined {
    return getSession(sessionId)?.archers.find((a) => a.id === archerId)
  }

  function createSession(input: SessionInput): Session {
    const now = Date.now()
    const archer: Archer = {
      id: createId(),
      name: DEFAULT_ARCHER_NAME,
      position: 'A',
      ends: emptyEnds(input.seriesCount * input.endsPerSeries, input.arrowsPerEnd),
    }
    const session: Session = {
      id: createId(),
      date: input.date,
      location: input.location,
      distance: input.distance,
      faceId: input.faceId,
      seriesCount: input.seriesCount,
      endsPerSeries: input.endsPerSeries,
      arrowsPerEnd: input.arrowsPerEnd,
      archers: [archer],
      notes: input.notes ?? '',
      closed: false,
      createdAt: now,
      updatedAt: now,
    }
    sessions.value.push(session)
    // Return the reactive proxy so callers mutate tracked state.
    return sessions.value[sessions.value.length - 1]!
  }

  /** Writes one arrow. No-op if the session is closed or the target/key is invalid. */
  function setArrow(
    sessionId: string,
    archerId: string,
    row: number,
    arrow: number,
    key: string | null,
  ): void {
    const session = getSession(sessionId)
    if (!session || session.closed) return
    const end = session.archers.find((a) => a.id === archerId)?.ends[row]
    if (!end || !Number.isInteger(arrow) || arrow < 0 || arrow >= end.length) return
    const face = key === null ? undefined : getTargetFace(session.faceId)
    if (key !== null && !face?.zones.some((z) => z.key === key)) return
    end[arrow] = key
    // CU-06: a complete end is kept sorted, written back in place to keep the array's identity.
    // A null write never completes an end, so deleting an arrow never sorts: the gap stays where
    // the arrow was.
    if (face && !end.includes(null)) {
      sortEnd(end, face).forEach((k, i) => {
        end[i] = k
      })
    }
    session.updatedAt = Date.now()
  }

  /** Empties every arrow of one end. No-op if the session is closed or the target is invalid. */
  function deleteEnd(sessionId: string, archerId: string, row: number): void {
    const session = getSession(sessionId)
    if (!session || session.closed) return
    const archer = session.archers.find((a) => a.id === archerId)
    if (!archer || !Number.isInteger(row)) return
    const end = archer.ends[row]
    if (!end) return
    for (let i = 0; i < end.length; i++) end[i] = null
    session.updatedAt = Date.now()
  }

  /**
   * Finalizes (true) or reopens (false) a session (CU-10). Idempotent: no-op, and no updatedAt
   * change, if the session is missing or already has that value.
   */
  function setClosed(sessionId: string, closed: boolean): void {
    const session = getSession(sessionId)
    if (!session || session.closed === closed) return
    session.closed = closed
    session.updatedAt = Date.now()
  }

  /**
   * Edits a session's data (CU-11). Closed sessions are editable and stay closed.
   * - Each field applies only if present and valid: date and notes strings, location a string
   *   (stored trimmed), distance finite and ≥ 0, faceId a catalogue face, and the structure
   *   triple (patch value, else the stored one) all positive integers, else the whole structure
   *   part is ignored.
   * - With any arrow scored, faceId and the structure are silently ignored; the rest still applies.
   * - A real structure change (only possible without arrows) regenerates every archer's ends empty
   *   with the new size; an unchanged structure never touches the ends.
   * - updatedAt changes only if some field really changed. id, createdAt, closed, archers' ids,
   *   names and arrows are never touched. A missing session is a no-op.
   */
  function updateSession(id: string, patch: SessionPatch): void {
    const session = getSession(id)
    if (!session) return
    let changed = false

    if (typeof patch.date === 'string' && patch.date !== session.date) {
      session.date = patch.date
      changed = true
    }
    if (typeof patch.location === 'string') {
      const location = patch.location.trim()
      if (location !== session.location) {
        session.location = location
        changed = true
      }
    }
    if (
      typeof patch.distance === 'number' &&
      Number.isFinite(patch.distance) &&
      patch.distance >= 0 &&
      patch.distance !== session.distance
    ) {
      session.distance = patch.distance
      changed = true
    }
    if (typeof patch.notes === 'string' && patch.notes !== session.notes) {
      session.notes = patch.notes
      changed = true
    }

    if (!hasAnyArrow(session.archers)) {
      if (
        typeof patch.faceId === 'string' &&
        patch.faceId !== session.faceId &&
        getTargetFace(patch.faceId)
      ) {
        session.faceId = patch.faceId
        changed = true
      }
      const seriesCount = patch.seriesCount ?? session.seriesCount
      const endsPerSeries = patch.endsPerSeries ?? session.endsPerSeries
      const arrowsPerEnd = patch.arrowsPerEnd ?? session.arrowsPerEnd
      const valid = [seriesCount, endsPerSeries, arrowsPerEnd].every(
        (n) => Number.isInteger(n) && n > 0,
      )
      const structureChanged =
        seriesCount !== session.seriesCount ||
        endsPerSeries !== session.endsPerSeries ||
        arrowsPerEnd !== session.arrowsPerEnd
      if (valid && structureChanged) {
        session.seriesCount = seriesCount
        session.endsPerSeries = endsPerSeries
        session.arrowsPerEnd = arrowsPerEnd
        for (const archer of session.archers) {
          archer.ends = emptyEnds(seriesCount * endsPerSeries, arrowsPerEnd)
        }
        changed = true
      }
    }

    if (changed) session.updatedAt = Date.now()
  }

  /**
   * Deletes a session and all its arrows (CU-12). A missing id is a no-op; the other sessions are
   * left untouched (same objects). Persisted by the state watch below.
   */
  function deleteSession(id: string): void {
    const index = sessions.value.findIndex((s) => s.id === id)
    if (index === -1) return
    sessions.value.splice(index, 1)
  }

  /** The whole state as backup JSON (CU-11). Works with zero sessions. */
  function exportJson(now: Date = new Date()): string {
    return serializeBackup(
      { version: 1, sessions: sessions.value, profileName: profileName.value },
      now,
    )
  }

  /**
   * Validates a backup and previews the merge without touching any state. `apply()` re-plans
   * against the current sessions, so its counts are the ones actually applied.
   */
  function importJson(text: string): ImportPreview {
    const parsed = parseBackup(text)
    if (!parsed.ok) return parsed
    const incoming = parsed.state
    const preview = planMerge(sessions.value, incoming.sessions)
    function apply(): ImportResult {
      const plan = planMerge(sessions.value, incoming.sessions)
      const merged = plan.added + plan.updated > 0
      if (merged) sessions.value = plan.sessions
      const profileAdopted = profileName.value.trim() === '' && incoming.profileName.trim() !== ''
      if (profileAdopted) profileName.value = incoming.profileName
      // Saved explicitly so the result can report a storage failure; the deep watch saves too.
      const saved =
        merged || profileAdopted
          ? save({ version: 1, sessions: sessions.value, profileName: profileName.value })
          : true
      return { added: plan.added, updated: plan.updated, unchanged: plan.unchanged, saved }
    }
    return {
      ok: true,
      total: incoming.sessions.length,
      added: preview.added,
      updated: preview.updated,
      unchanged: preview.unchanged,
      apply,
    }
  }

  watch(
    () => ({ version: 1 as const, sessions: sessions.value, profileName: profileName.value }),
    (state) => {
      save(state)
    },
    { deep: true },
  )

  return {
    sessions,
    profileName,
    sortedSessions,
    getSession,
    getArcher,
    createSession,
    setArrow,
    deleteEnd,
    setClosed,
    updateSession,
    deleteSession,
    exportJson,
    importJson,
  }
})
