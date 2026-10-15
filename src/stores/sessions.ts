import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { usePersistence } from '@/composables/usePersistence'
import { createId } from '@/domain/ids'
import { sortEnd } from '@/domain/scoring'
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

function emptyEnds(rows: number, arrows: number): End[] {
  return Array.from({ length: rows }, () => Array.from({ length: arrows }, () => null))
}

export const useSessionsStore = defineStore('sessions', () => {
  const { load, save } = usePersistence()
  const initial = load()

  const sessions = ref<Session[]>(initial.sessions)
  const profileName = ref(initial.profileName)

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

  watch(
    () => ({ version: 1 as const, sessions: sessions.value, profileName: profileName.value }),
    (state) => {
      save(state)
    },
    { deep: true },
  )

  return { sessions, profileName, getSession, getArcher, createSession, setArrow, deleteEnd }
})
