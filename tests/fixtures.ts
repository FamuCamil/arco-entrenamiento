import type { PersistedState, Session } from '@/domain/types'

/** A valid WA 40, 2x10x3 session with one archer and empty ends, for seeding tests. */
export function makeSession(overrides: Partial<Session> = {}): Session {
  const seriesCount = overrides.seriesCount ?? 2
  const endsPerSeries = overrides.endsPerSeries ?? 10
  const arrowsPerEnd = overrides.arrowsPerEnd ?? 3
  return {
    id: 's1',
    date: '2026-10-15',
    location: 'Club',
    distance: 18,
    faceId: 'wa-40',
    seriesCount,
    endsPerSeries,
    arrowsPerEnd,
    archers: [
      {
        id: 'a1',
        name: 'Yo',
        position: 'A',
        ends: Array.from({ length: seriesCount * endsPerSeries }, () =>
          Array.from({ length: arrowsPerEnd }, () => null),
        ),
      },
    ],
    notes: '',
    closed: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

export function makeState(sessions: Session[] = [makeSession()]): PersistedState {
  return { version: 1, sessions, profileName: '' }
}
