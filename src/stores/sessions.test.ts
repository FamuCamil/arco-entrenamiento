import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, toRaw } from 'vue'

import { STORAGE_KEY } from '@/composables/usePersistence'
import type { Session } from '@/domain/types'
import { makeSession, makeState } from '../../tests/fixtures'
import {
  DEFAULT_ARCHER_NAME,
  useSessionsStore,
  type SessionInput,
  type SessionPatch,
} from './sessions'

const INPUT: SessionInput = {
  date: '2026-10-15',
  location: 'Sesión de prueba',
  distance: 18,
  faceId: 'wa-40',
  seriesCount: 2,
  endsPerSeries: 10,
  arrowsPerEnd: 3,
}

function stored() {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === null ? null : JSON.parse(raw)
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('hydration', () => {
  it('starts empty with nothing stored', () => {
    const store = useSessionsStore()
    expect(store.sessions).toEqual([])
    expect(store.profileName).toBe('')
  })

  it('hydrates sessions and profileName from storage', () => {
    const state = makeState()
    state.profileName = 'Ana'
    state.sessions[0]!.archers[0]!.ends[0] = ['X', null, null]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    const store = useSessionsStore()
    expect(store.sessions).toEqual(state.sessions)
    expect(store.profileName).toBe('Ana')
  })

  it('starts empty on corrupt storage without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(useSessionsStore().sessions).toEqual([])
  })
})

describe('createSession', () => {
  it('builds a session with one archer «Yo» at position A and an empty ends matrix', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_760_000_000_000)
    const store = useSessionsStore()
    const s = store.createSession(INPUT)
    expect(DEFAULT_ARCHER_NAME).toBe('Yo')
    expect(s).toMatchObject({ ...INPUT, notes: '', closed: false })
    expect(s.createdAt).toBe(1_760_000_000_000)
    expect(s.updatedAt).toBe(1_760_000_000_000)
    expect(s.archers).toHaveLength(1)
    const archer = s.archers[0]!
    expect(archer.name).toBe('Yo')
    expect(archer.position).toBe('A')
    expect(archer.ends).toHaveLength(20)
    for (const end of archer.ends) expect(end).toEqual([null, null, null])
    expect(store.sessions).toHaveLength(1)
  })

  it('keeps the given notes', () => {
    expect(useSessionsStore().createSession({ ...INPUT, notes: 'viento' }).notes).toBe('viento')
  })

  it('creates independent end rows', () => {
    const s = useSessionsStore().createSession(INPUT)
    s.archers[0]!.ends[0]![0] = 'X'
    expect(s.archers[0]!.ends[1]![0]).toBeNull()
  })

  it('assigns distinct ids to sessions and archers', () => {
    const store = useSessionsStore()
    const a = store.createSession(INPUT)
    const b = store.createSession(INPUT)
    const ids = [a.id, b.id, a.archers[0]!.id, b.archers[0]!.id]
    expect(new Set(ids).size).toBe(4)
  })

  it('returns the reactive session held by the store', () => {
    const store = useSessionsStore()
    const s = store.createSession(INPUT)
    expect(store.getSession(s.id)).toBe(s)
  })

  it('persists the new session', async () => {
    const store = useSessionsStore()
    const s = store.createSession(INPUT)
    await nextTick()
    expect(stored()).toMatchObject({ version: 1, profileName: '', sessions: [{ id: s.id }] })
  })
})

describe('getters', () => {
  it('getSession / getArcher find by id', () => {
    const store = useSessionsStore()
    const s = store.createSession(INPUT)
    const a = s.archers[0]!
    expect(store.getSession(s.id)?.id).toBe(s.id)
    expect(store.getArcher(s.id, a.id)?.id).toBe(a.id)
  })

  it('return undefined for unknown ids', () => {
    const store = useSessionsStore()
    const s = store.createSession(INPUT)
    expect(store.getSession('nope')).toBeUndefined()
    expect(store.getArcher('nope', s.archers[0]!.id)).toBeUndefined()
    expect(store.getArcher(s.id, 'nope')).toBeUndefined()
  })
})

describe('setArrow', () => {
  function setup(overrides = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([makeSession(overrides)])))
    const store = useSessionsStore()
    return { store, ends: () => store.getArcher('s1', 'a1')!.ends }
  }

  it('writes the key into the cell, bumps updatedAt and persists', async () => {
    const { store, ends } = setup()
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    store.setArrow('s1', 'a1', 3, 2, 'X')
    expect(ends()[3]).toEqual([null, null, 'X'])
    expect(store.getSession('s1')!.updatedAt).toBe(5000)
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[3]).toEqual([null, null, 'X'])
    expect(stored().sessions[0].updatedAt).toBe(5000)
  })

  it('overwrites an existing value', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, '9')
    store.setArrow('s1', 'a1', 0, 0, 'M')
    expect(ends()[0]![0]).toBe('M')
  })

  it('overwriting a cell of a complete end re-sorts it and persists it sorted (CU-06)', async () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, 'X')
    store.setArrow('s1', 'a1', 0, 1, '9')
    store.setArrow('s1', 'a1', 0, 2, '8')
    store.setArrow('s1', 'a1', 1, 0, '7')
    await nextTick()
    store.setArrow('s1', 'a1', 0, 1, '2')
    expect(ends()[0]).toEqual(['X', '8', '2'])
    // An incomplete end is never sorted.
    expect(ends()[1]).toEqual(['7', null, null])
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[0]).toEqual(['X', '8', '2'])
  })

  it('completing an end out of order sorts it and persists it sorted (CU-06)', async () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, '7')
    store.setArrow('s1', 'a1', 0, 1, 'M')
    expect(ends()[0]).toEqual(['7', 'M', null])
    store.setArrow('s1', 'a1', 0, 2, 'X')
    expect(ends()[0]).toEqual(['X', '7', 'M'])
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[0]).toEqual(['X', '7', 'M'])
  })

  it('sorts when the last gap filled is in the middle of the end', async () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, '8')
    store.setArrow('s1', 'a1', 0, 2, 'X')
    expect(ends()[0]).toEqual(['8', null, 'X'])
    store.setArrow('s1', 'a1', 0, 1, '9')
    expect(ends()[0]).toEqual(['X', '9', '8'])
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[0]).toEqual(['X', '9', '8'])
  })

  it('never reorders an incomplete end', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, '7')
    store.setArrow('s1', 'a1', 0, 1, 'X')
    expect(ends()[0]).toEqual(['7', 'X', null])
    // Overwriting a cell of an incomplete end does not sort either.
    store.setArrow('s1', 'a1', 0, 0, 'M')
    expect(ends()[0]).toEqual(['M', 'X', null])
  })

  it('keeps the end array identity when it sorts', () => {
    const { store, ends } = setup()
    const row = ends()[0]
    store.setArrow('s1', 'a1', 0, 0, 'M')
    store.setArrow('s1', 'a1', 0, 1, '7')
    store.setArrow('s1', 'a1', 0, 2, 'X')
    expect(ends()[0]).toBe(row)
    expect(row).toEqual(['X', '7', 'M'])
    expect(row).toHaveLength(3)
  })

  it('sorts a completed 3D end by the 3D face order', async () => {
    const { store, ends } = setup({
      faceId: '3d',
      arrowsPerEnd: 4,
      seriesCount: 1,
      endsPerSeries: 3,
    })
    store.setArrow('s1', 'a1', 0, 0, '5')
    store.setArrow('s1', 'a1', 0, 1, '11')
    store.setArrow('s1', 'a1', 0, 2, 'M')
    store.setArrow('s1', 'a1', 0, 3, '8')
    expect(ends()[0]).toEqual(['11', '8', '5', 'M'])
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[0]).toEqual(['11', '8', '5', 'M'])
  })

  it('sorts a hydrated unsorted complete end on its next correction, not on load', () => {
    const session = makeSession()
    session.archers[0]!.ends[0] = ['8', 'X', '9']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
    const store = useSessionsStore()
    const ends = () => store.getArcher('s1', 'a1')!.ends
    expect(ends()[0]).toEqual(['8', 'X', '9'])
    store.setArrow('s1', 'a1', 0, 0, '7')
    expect(ends()[0]).toEqual(['X', '9', '7'])
  })

  it('writes a later row while earlier rows are still empty', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 5, 1, '10')
    expect(ends()[5]).toEqual([null, '10', null])
    for (const r of [0, 1, 2, 3, 4]) expect(ends()[r]).toEqual([null, null, null])
  })

  it('accepts null (clears the cell)', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 0, '9')
    store.setArrow('s1', 'a1', 0, 0, null)
    expect(ends()[0]![0]).toBeNull()
  })

  it('accepts every key of the session face', () => {
    const { store, ends } = setup({
      faceId: '3d',
      arrowsPerEnd: 2,
      seriesCount: 1,
      endsPerSeries: 3,
    })
    store.setArrow('s1', 'a1', 0, 0, '11')
    store.setArrow('s1', 'a1', 0, 1, '5')
    expect(ends()[0]).toEqual(['11', '5'])
  })

  const noops: [string, (store: ReturnType<typeof useSessionsStore>) => void][] = [
    ['an unknown session', (s) => s.setArrow('nope', 'a1', 0, 0, 'X')],
    ['an unknown archer', (s) => s.setArrow('s1', 'nope', 0, 0, 'X')],
    ['a negative row', (s) => s.setArrow('s1', 'a1', -1, 0, 'X')],
    ['a row past the end', (s) => s.setArrow('s1', 'a1', 20, 0, 'X')],
    ['a negative arrow', (s) => s.setArrow('s1', 'a1', 0, -1, 'X')],
    ['an arrow past the end', (s) => s.setArrow('s1', 'a1', 0, 3, 'X')],
    ['a fractional arrow', (s) => s.setArrow('s1', 'a1', 0, 0.5, 'X')],
    ['a key that is not on the face', (s) => s.setArrow('s1', 'a1', 0, 0, '11')],
  ]

  it.each(noops)('is a no-op for %s', async (_, act) => {
    const { store } = setup()
    const before = JSON.stringify(store.sessions)
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    act(store)
    expect(JSON.stringify(store.sessions)).toBe(before)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('is a no-op when the session is closed', () => {
    const { store, ends } = setup({ closed: true })
    store.setArrow('s1', 'a1', 0, 0, 'X')
    expect(ends()[0]).toEqual([null, null, null])
    expect(store.getSession('s1')!.updatedAt).toBe(1)
  })

  it('does not sort a complete end of a closed session (CU-06)', async () => {
    const session = makeSession({ closed: true })
    session.archers[0]!.ends[0] = ['8', 'X', '9']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
    const store = useSessionsStore()
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    store.setArrow('s1', 'a1', 0, 0, '7')
    expect(store.getArcher('s1', 'a1')!.ends[0]).toEqual(['8', 'X', '9'])
    expect(store.getSession('s1')!.updatedAt).toBe(1)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('is a no-op when the session face is unknown', () => {
    const { store, ends } = setup({ faceId: 'missing-face' })
    store.setArrow('s1', 'a1', 0, 0, 'X')
    expect(ends()[0]).toEqual([null, null, null])
  })
})

describe('deleteEnd', () => {
  function setup(overrides = {}) {
    const session = makeSession(overrides)
    session.archers[0]!.ends[0] = ['X', '9', '8']
    session.archers[0]!.ends[1] = ['7', null, '5']
    session.archers[0]!.ends[2] = ['4', '3', '2']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
    const store = useSessionsStore()
    return { store, ends: () => store.getArcher('s1', 'a1')!.ends }
  }

  it('empties only the target end, bumps updatedAt and persists', async () => {
    const { store, ends } = setup()
    vi.useFakeTimers()
    vi.setSystemTime(7000)
    store.deleteEnd('s1', 'a1', 1)
    expect(ends()[0]).toEqual(['X', '9', '8'])
    expect(ends()[1]).toEqual([null, null, null])
    expect(ends()[2]).toEqual(['4', '3', '2'])
    expect(store.getSession('s1')!.updatedAt).toBe(7000)
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[1]).toEqual([null, null, null])
    expect(stored().sessions[0].archers[0].ends[0]).toEqual(['X', '9', '8'])
    expect(stored().sessions[0].updatedAt).toBe(7000)
  })

  it('empties a complete end in place (same array, same length)', () => {
    const { store, ends } = setup()
    const row = ends()[0]
    store.deleteEnd('s1', 'a1', 0)
    expect(ends()[0]).toBe(row)
    expect(row).toEqual([null, null, null])
  })

  it('empties the last end of the session', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 19, 0, 'X')
    store.deleteEnd('s1', 'a1', 19)
    expect(ends()[19]).toEqual([null, null, null])
  })

  it('setArrow(null) on a complete end leaves a gap and does not reorder (CU-06 pitfall)', () => {
    const { store, ends } = setup()
    store.setArrow('s1', 'a1', 0, 1, null)
    expect(ends()[0]).toEqual(['X', null, '8'])
  })

  it('setArrow(null) on an unsorted complete end leaves the gap in place (CU-06)', async () => {
    const { store, ends } = setup()
    // Seed an unsorted complete end, as data stored before CU-06 may hold it.
    store.getSession('s1')!.archers[0]!.ends[2] = ['8', 'X', '9']
    store.setArrow('s1', 'a1', 2, 0, null)
    expect(ends()[2]).toEqual([null, 'X', '9'])
    await nextTick()
    expect(stored().sessions[0].archers[0].ends[2]).toEqual([null, 'X', '9'])
  })

  const noops: [string, (store: ReturnType<typeof useSessionsStore>) => void][] = [
    ['an unknown session', (s) => s.deleteEnd('nope', 'a1', 0)],
    ['an unknown archer', (s) => s.deleteEnd('s1', 'nope', 0)],
    ['a negative row', (s) => s.deleteEnd('s1', 'a1', -1)],
    ['a row past the end', (s) => s.deleteEnd('s1', 'a1', 20)],
    ['a fractional row', (s) => s.deleteEnd('s1', 'a1', 0.5)],
    ['a NaN row', (s) => s.deleteEnd('s1', 'a1', Number.NaN)],
  ]

  it.each(noops)('is a no-op for %s', async (_, act) => {
    const { store } = setup()
    const before = JSON.stringify(store.sessions)
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    act(store)
    expect(JSON.stringify(store.sessions)).toBe(before)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('is a no-op when the session is closed (values and updatedAt unchanged)', async () => {
    const { store, ends } = setup({ closed: true })
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    store.deleteEnd('s1', 'a1', 0)
    expect(ends()[0]).toEqual(['X', '9', '8'])
    expect(store.getSession('s1')!.updatedAt).toBe(1)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('setArrow(null) is also a no-op when the session is closed', () => {
    const { store, ends } = setup({ closed: true })
    store.setArrow('s1', 'a1', 0, 0, null)
    expect(ends()[0]).toEqual(['X', '9', '8'])
    expect(store.getSession('s1')!.updatedAt).toBe(1)
  })
})

describe('setClosed (CU-10)', () => {
  function setup(overrides = {}) {
    const session = makeSession(overrides)
    session.archers[0]!.ends[0] = ['X', '9', null]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
    return useSessionsStore()
  }

  it('closing sets closed, bumps updatedAt and persists', async () => {
    const store = setup()
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.setClosed('s1', true)
    expect(store.getSession('s1')!.closed).toBe(true)
    expect(store.getSession('s1')!.updatedAt).toBe(9000)
    await nextTick()
    expect(stored().sessions[0].closed).toBe(true)
    expect(stored().sessions[0].updatedAt).toBe(9000)
  })

  it('reopening sets closed false, bumps updatedAt and persists', async () => {
    const store = setup({ closed: true })
    vi.useFakeTimers()
    vi.setSystemTime(9500)
    store.setClosed('s1', false)
    expect(store.getSession('s1')!.closed).toBe(false)
    expect(store.getSession('s1')!.updatedAt).toBe(9500)
    await nextTick()
    expect(stored().sessions[0].closed).toBe(false)
    expect(stored().sessions[0].updatedAt).toBe(9500)
  })

  it.each([true, false])(
    'is a no-op when the session already has closed = %s (updatedAt unchanged, no save)',
    async (closed) => {
      const store = setup({ closed })
      await nextTick()
      localStorage.removeItem(STORAGE_KEY)
      const before = JSON.stringify(store.sessions)
      store.setClosed('s1', closed)
      expect(store.getSession('s1')!.closed).toBe(closed)
      expect(store.getSession('s1')!.updatedAt).toBe(1)
      expect(JSON.stringify(store.sessions)).toBe(before)
      await nextTick()
      expect(stored()).toBeNull()
    },
  )

  it('is a no-op for an unknown session', async () => {
    const store = setup()
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    const before = JSON.stringify(store.sessions)
    expect(() => store.setClosed('nope', true)).not.toThrow()
    expect(JSON.stringify(store.sessions)).toBe(before)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('keeps the values: closing and reopening never touch the ends', () => {
    const store = setup()
    store.setClosed('s1', true)
    store.setClosed('s1', false)
    expect(store.getArcher('s1', 'a1')!.ends[0]).toEqual(['X', '9', null])
  })

  it('blocks setArrow and deleteEnd after closing; both work again after reopening', () => {
    const store = setup()
    const ends = () => store.getArcher('s1', 'a1')!.ends
    store.setClosed('s1', true)
    store.setArrow('s1', 'a1', 0, 2, '8')
    store.deleteEnd('s1', 'a1', 0)
    expect(ends()[0]).toEqual(['X', '9', null])
    store.setClosed('s1', false)
    store.setArrow('s1', 'a1', 0, 2, '8')
    expect(ends()[0]).toEqual(['X', '9', '8'])
    store.deleteEnd('s1', 'a1', 0)
    expect(ends()[0]).toEqual([null, null, null])
  })

  it('a closed session survives a reload (fresh store hydrates closed: true)', async () => {
    setup().setClosed('s1', true)
    await nextTick()
    setActivePinia(createPinia())
    expect(useSessionsStore().getSession('s1')!.closed).toBe(true)
  })

  it('old sessions saved with closed: false hydrate open (no migration, AC9)', () => {
    const store = setup()
    expect(store.getSession('s1')!.closed).toBe(false)
  })
})

describe('persistence watch', () => {
  it('persists profileName changes', async () => {
    const store = useSessionsStore()
    store.profileName = 'Luis'
    await nextTick()
    expect(stored()).toEqual({ version: 1, sessions: [], profileName: 'Luis' })
  })

  it('does not throw when saving fails', async () => {
    const store = useSessionsStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    store.createSession(INPUT)
    await expect(nextTick()).resolves.toBeUndefined()
    expect(store.sessions).toHaveLength(1)
  })
})

describe('sortedSessions', () => {
  function seedSessions() {
    const sessions = [
      makeSession({ id: 'old', date: '2026-01-10', createdAt: 5 }),
      makeSession({ id: 'new-early', date: '2026-10-15', createdAt: 1 }),
      makeSession({ id: 'mid', date: '2026-05-01', createdAt: 9 }),
      makeSession({ id: 'new-late', date: '2026-10-15', createdAt: 3 }),
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState(sessions)))
    return useSessionsStore()
  }

  it('is empty with no sessions', () => {
    expect(useSessionsStore().sortedSessions).toEqual([])
  })

  it('orders by date descending, then createdAt descending on equal dates', () => {
    const store = seedSessions()
    expect(store.sortedSessions.map((s) => s.id)).toEqual(['new-late', 'new-early', 'mid', 'old'])
  })

  it('compares dates across years', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        makeState([
          makeSession({ id: 'a', date: '2025-12-31' }),
          makeSession({ id: 'b', date: '2026-01-01' }),
        ]),
      ),
    )
    expect(useSessionsStore().sortedSessions.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('does not reorder the underlying sessions array', () => {
    const store = seedSessions()
    void store.sortedSessions
    expect(store.sessions.map((s) => s.id)).toEqual(['old', 'new-early', 'mid', 'new-late'])
  })

  it('reacts to createSession', () => {
    const store = seedSessions()
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const created = store.createSession({ ...INPUT, date: '2026-10-15' })
    expect(store.sortedSessions[0]!.id).toBe(created.id)
    const older = store.createSession({ ...INPUT, date: '2020-01-01' })
    expect(store.sortedSessions.at(-1)!.id).toBe(older.id)
  })

  it('holds the same reactive sessions, not copies', () => {
    const store = seedSessions()
    expect(store.sortedSessions[0]).toBe(store.getSession('new-late'))
  })
})

describe('exportJson / importJson (CU-11)', () => {
  const NOW = new Date(Date.UTC(2026, 9, 17, 10, 0, 0))

  function seedStore(sessions = [makeSession()], profileName = '') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...makeState(sessions), profileName }))
    return useSessionsStore()
  }

  function file(sessions: ReturnType<typeof makeSession>[], profileName = '') {
    return JSON.stringify({ ...makeState(sessions), profileName, exportedAt: NOW.toISOString() })
  }

  function quotaFull() {
    return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
  }

  it('exports the whole state as indented backup JSON', () => {
    const s = makeSession()
    s.archers[0]!.ends[0] = ['X', '9', null]
    const store = seedStore([s], 'Ana')
    const json = store.exportJson(NOW)
    expect(json).toContain('\n  "version": 1')
    expect(JSON.parse(json)).toEqual({
      version: 1,
      sessions: [s],
      profileName: 'Ana',
      exportedAt: '2026-10-17T10:00:00.000Z',
    })
  })

  it('exports a valid empty copy with zero sessions', () => {
    const json = useSessionsStore().exportJson(NOW)
    expect(JSON.parse(json)).toEqual({
      version: 1,
      sessions: [],
      profileName: '',
      exportedAt: NOW.toISOString(),
    })
  })

  it('exportJson defaults to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(JSON.parse(useSessionsStore().exportJson()).exportedAt).toBe(NOW.toISOString())
  })

  it('round-trips: export, clear, import gives identical sessions', () => {
    const s = makeSession({ id: 'a', closed: true, updatedAt: 8 })
    s.archers[0]!.ends[2] = ['10', '10', '9']
    const json = seedStore([s, makeSession({ id: 'b' })], 'Ana').exportJson(NOW)
    localStorage.clear()
    setActivePinia(createPinia())
    const store = useSessionsStore()
    const preview = store.importJson(json)
    expect(preview.ok && preview.apply()).toEqual({
      added: 2,
      updated: 0,
      unchanged: 0,
      saved: true,
    })
    expect(store.sessions).toEqual([s, makeSession({ id: 'b' })])
    expect(store.profileName).toBe('Ana')
  })

  it('importJson previews the counts without mutating anything before apply', async () => {
    const store = seedStore([makeSession({ id: 'a', updatedAt: 1 })])
    const before = JSON.parse(JSON.stringify(store.sessions))
    const storedBefore = localStorage.getItem(STORAGE_KEY)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const preview = store.importJson(
      file([makeSession({ id: 'a', updatedAt: 2 }), makeSession({ id: 'b' })], 'Luis'),
    )
    expect(preview).toMatchObject({ ok: true, total: 2, added: 1, updated: 1, unchanged: 0 })
    await nextTick()
    expect(store.sessions).toEqual(before)
    expect(store.profileName).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('apply adds, updates and keeps; locals first then added; persisted with saved: true', async () => {
    const keep = makeSession({ id: 'keep', updatedAt: 5 })
    const mine = makeSession({ id: 'mine' })
    const store = seedStore([makeSession({ id: 'upd', updatedAt: 1 }), keep, mine])
    const newer = makeSession({ id: 'upd', updatedAt: 9, closed: true })
    newer.archers[0]!.ends[0] = ['X', 'X', 'X']
    const preview = store.importJson(
      file([
        makeSession({ id: 'keep', updatedAt: 5, notes: 'otra' }),
        newer,
        makeSession({ id: 'new' }),
      ]),
    )
    if (!preview.ok) throw new Error(preview.error)
    const result = preview.apply()
    expect(result).toEqual({ added: 1, updated: 1, unchanged: 1, saved: true })
    expect(store.sessions.map((s) => s.id)).toEqual(['upd', 'keep', 'mine', 'new'])
    expect(store.sessions[0]).toEqual(newer)
    expect(store.sessions[1]).toEqual(keep)
    expect(stored().sessions).toEqual(store.sessions)
    await nextTick()
    expect(stored().sessions.map((s: { id: string }) => s.id)).toEqual([
      'upd',
      'keep',
      'mine',
      'new',
    ])
  })

  it('apply assigns the sessions array once', () => {
    const store = seedStore([makeSession({ id: 'a' })])
    const preview = store.importJson(file([makeSession({ id: 'b' }), makeSession({ id: 'c' })]))
    if (!preview.ok) throw new Error(preview.error)
    const original = store.sessions
    preview.apply()
    expect(store.sessions).not.toBe(original)
    expect(original.map((s) => s.id)).toEqual(['a'])
  })

  it('apply re-plans against the current sessions', () => {
    const store = seedStore([])
    const preview = store.importJson(file([makeSession({ id: 'a', updatedAt: 3 })]))
    if (!preview.ok) throw new Error(preview.error)
    expect(preview.added).toBe(1)
    store.sessions.push(makeSession({ id: 'a', updatedAt: 3 }))
    expect(preview.apply()).toEqual({ added: 0, updated: 0, unchanged: 1, saved: true })
    expect(store.sessions).toHaveLength(1)
  })

  it('importing the same file twice duplicates nothing', () => {
    const store = seedStore([])
    const json = file([makeSession({ id: 'a' }), makeSession({ id: 'b' })])
    const first = store.importJson(json)
    if (!first.ok) throw new Error(first.error)
    first.apply()
    const second = store.importJson(json)
    expect(second).toMatchObject({ ok: true, total: 2, added: 0, updated: 0, unchanged: 2 })
    if (!second.ok) throw new Error(second.error)
    expect(second.apply()).toEqual({ added: 0, updated: 0, unchanged: 2, saved: true })
    expect(store.sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('adopts the file profileName only when the local one is blank', () => {
    const blank = seedStore([], '   ')
    const preview = blank.importJson(file([makeSession()], 'Ana'))
    if (!preview.ok) throw new Error(preview.error)
    preview.apply()
    expect(blank.profileName).toBe('Ana')
    expect(stored().profileName).toBe('Ana')

    setActivePinia(createPinia())
    const named = seedStore([], 'Luis')
    const other = named.importJson(file([makeSession()], 'Ana'))
    if (!other.ok) throw new Error(other.error)
    other.apply()
    expect(named.profileName).toBe('Luis')
    expect(stored().profileName).toBe('Luis')
  })

  it('does not adopt a blank file profileName', () => {
    const store = seedStore([], '')
    const preview = store.importJson(file([makeSession()], '  '))
    if (!preview.ok) throw new Error(preview.error)
    preview.apply()
    expect(store.profileName).toBe('')
  })

  it('a profile-only adoption with all sessions up to date persists the name', () => {
    const s = makeSession()
    const store = seedStore([s], '')
    const preview = store.importJson(file([s], 'Ana'))
    expect(preview).toMatchObject({ ok: true, added: 0, updated: 0, unchanged: 1 })
    if (!preview.ok) throw new Error(preview.error)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    expect(preview.apply()).toEqual({ added: 0, updated: 0, unchanged: 1, saved: true })
    expect(setItem).toHaveBeenCalled()
    expect(stored().profileName).toBe('Ana')
  })

  it('nothing to change: apply writes nothing and reports saved: true', () => {
    const s = makeSession()
    const store = seedStore([s], 'Luis')
    const preview = store.importJson(file([s], 'Ana'))
    if (!preview.ok) throw new Error(preview.error)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    expect(preview.apply()).toEqual({ added: 0, updated: 0, unchanged: 1, saved: true })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports saved: false when storage is full (merge path)', () => {
    const store = seedStore([])
    const preview = store.importJson(file([makeSession({ id: 'a' })]))
    if (!preview.ok) throw new Error(preview.error)
    quotaFull()
    expect(preview.apply()).toEqual({ added: 1, updated: 0, unchanged: 0, saved: false })
    expect(store.sessions.map((s) => s.id)).toEqual(['a'])
  })

  it('reports saved: false when storage is full (profile-only path)', () => {
    const s = makeSession()
    const store = seedStore([s], '')
    const preview = store.importJson(file([s], 'Ana'))
    if (!preview.ok) throw new Error(preview.error)
    quotaFull()
    expect(preview.apply()).toEqual({ added: 0, updated: 0, unchanged: 1, saved: false })
    expect(store.profileName).toBe('Ana')
  })

  it.each([
    ['not JSON', '{oops', 'El archivo no es una copia válida: no contiene JSON.'],
    [
      'a damaged session',
      JSON.stringify(makeState([{ id: 'x' } as never])),
      'La copia tiene sesiones dañadas o incompletas. No se ha importado nada.',
    ],
  ])('returns ok: false for %s and changes nothing', async (_label, raw, error) => {
    const store = seedStore([makeSession({ id: 'a' })], 'Luis')
    const storedBefore = localStorage.getItem(STORAGE_KEY)
    expect(store.importJson(raw)).toEqual({ ok: false, error })
    await nextTick()
    expect(store.sessions.map((s) => s.id)).toEqual(['a'])
    expect(store.profileName).toBe('Luis')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore)
  })
})

describe('updateSession (CU-11)', () => {
  function setup(overrides: Partial<Session> = {}, arrow = false) {
    const session = makeSession(overrides)
    if (arrow) session.archers[0]!.ends[0] = ['X', '9', null]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
    return useSessionsStore()
  }

  function withSecondArcher(store: ReturnType<typeof useSessionsStore>) {
    const s = store.getSession('s1')!
    s.archers.push({
      id: 'a2',
      name: 'Otra',
      position: 'B',
      ends: s.archers[0]!.ends.map((end) => end.map(() => null)),
    })
    s.updatedAt = 1
  }

  const DETAILS: SessionPatch = {
    date: '2026-10-20',
    location: '  Polideportivo  ',
    distance: 25,
    notes: 'Viento\nfrío',
  }

  it('applies date, distance and notes, stores the place trimmed, bumps updatedAt and persists', async () => {
    const store = setup()
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', DETAILS)
    const s = store.getSession('s1')!
    expect(s).toMatchObject({
      date: '2026-10-20',
      location: 'Polideportivo',
      distance: 25,
      notes: 'Viento\nfrío',
      updatedAt: 9000,
    })
    await nextTick()
    expect(stored().sessions[0]).toMatchObject({ location: 'Polideportivo', updatedAt: 9000 })
  })

  it('distance 0 (Variable) is applied', () => {
    const store = setup()
    store.updateSession('s1', { distance: 0 })
    expect(store.getSession('s1')!.distance).toBe(0)
  })

  it('without arrows, a structure change regenerates every archer’s ends empty with the new size', () => {
    const store = setup()
    withSecondArcher(store)
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', { seriesCount: 3, endsPerSeries: 4, arrowsPerEnd: 5 })
    const s = store.getSession('s1')!
    expect([s.seriesCount, s.endsPerSeries, s.arrowsPerEnd]).toEqual([3, 4, 5])
    expect(s.updatedAt).toBe(9000)
    for (const archer of s.archers) {
      expect(archer.ends).toHaveLength(12)
      for (const end of archer.ends) expect(end).toEqual([null, null, null, null, null])
    }
    expect(s.archers.map((a) => [a.id, a.name, a.position])).toEqual([
      ['a1', 'Yo', 'A'],
      ['a2', 'Otra', 'B'],
    ])
  })

  it('a partial structure patch keeps the other stored values', () => {
    const store = setup()
    store.updateSession('s1', { arrowsPerEnd: 6 })
    const s = store.getSession('s1')!
    expect([s.seriesCount, s.endsPerSeries, s.arrowsPerEnd]).toEqual([2, 10, 6])
    expect(s.archers[0]!.ends).toHaveLength(20)
    expect(s.archers[0]!.ends[19]).toHaveLength(6)
  })

  it('an unchanged structure never touches the ends array', () => {
    const store = setup()
    const ends = store.getSession('s1')!.archers[0]!.ends
    store.updateSession('s1', { seriesCount: 2, endsPerSeries: 10, arrowsPerEnd: 3, notes: 'x' })
    expect(store.getSession('s1')!.archers[0]!.ends).toBe(ends)
  })

  it('without arrows, a catalogue face change applies', () => {
    const store = setup()
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', { faceId: 'wa-field' })
    expect(store.getSession('s1')!.faceId).toBe('wa-field')
    expect(store.getSession('s1')!.updatedAt).toBe(9000)
  })

  it('with an arrow, face and structure are ignored, details still apply, ends unchanged', () => {
    const store = setup({}, true)
    const before = structuredClone(toRaw(store.getSession('s1')!.archers))
    store.updateSession('s1', {
      ...DETAILS,
      faceId: 'wa-field',
      seriesCount: 1,
      endsPerSeries: 2,
      arrowsPerEnd: 6,
    })
    const s = store.getSession('s1')!
    expect(s).toMatchObject({
      faceId: 'wa-40',
      seriesCount: 2,
      endsPerSeries: 10,
      arrowsPerEnd: 3,
      location: 'Polideportivo',
      notes: 'Viento\nfrío',
    })
    expect(s.archers).toEqual(before)
    expect(s.archers[0]!.ends[0]).toEqual(['X', '9', null])
  })

  it('an arrow in a second archer also locks face and structure', () => {
    const store = setup()
    withSecondArcher(store)
    store.getSession('s1')!.archers[1]!.ends[5]![1] = 'M'
    store.updateSession('s1', { faceId: '3d', arrowsPerEnd: 4 })
    const s = store.getSession('s1')!
    expect([s.faceId, s.arrowsPerEnd]).toEqual(['wa-40', 3])
    expect(s.archers[1]!.ends[5]).toEqual([null, 'M', null])
  })

  it('with an arrow, a face/structure-only patch changes nothing and keeps updatedAt', async () => {
    const store = setup({}, true)
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    const before = JSON.stringify(store.sessions)
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', { faceId: '3d', seriesCount: 1, endsPerSeries: 1, arrowsPerEnd: 1 })
    expect(JSON.stringify(store.sessions)).toBe(before)
    expect(store.getSession('s1')!.updatedAt).toBe(1)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('a patch identical to the stored values keeps updatedAt and saves nothing', async () => {
    const store = setup({ notes: 'n' })
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    const s = store.getSession('s1')!
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', {
      date: s.date,
      location: '  Club ',
      distance: s.distance,
      faceId: s.faceId,
      seriesCount: s.seriesCount,
      endsPerSeries: s.endsPerSeries,
      arrowsPerEnd: s.arrowsPerEnd,
      notes: 'n',
    })
    expect(store.getSession('s1')!.updatedAt).toBe(1)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('an empty patch is a no-op', () => {
    const store = setup()
    const before = JSON.stringify(store.sessions)
    store.updateSession('s1', {})
    expect(JSON.stringify(store.sessions)).toBe(before)
  })

  it('never touches id, createdAt or closed', () => {
    const store = setup({ createdAt: 5, closed: false })
    store.updateSession('s1', {
      ...DETAILS,
      id: 'other',
      createdAt: 99,
      closed: true,
    } as SessionPatch)
    const s = store.getSession('s1')!
    expect([s.id, s.createdAt, s.closed]).toEqual(['s1', 5, false])
  })

  it('a closed session is editable and stays closed; its arrows are kept', async () => {
    const store = setup({ closed: true }, true)
    vi.useFakeTimers()
    vi.setSystemTime(9000)
    store.updateSession('s1', { notes: 'Final', arrowsPerEnd: 6 })
    const s = store.getSession('s1')!
    expect([s.notes, s.closed, s.arrowsPerEnd, s.updatedAt]).toEqual(['Final', true, 3, 9000])
    expect(s.archers[0]!.ends[0]).toEqual(['X', '9', null])
    await nextTick()
    expect(stored().sessions[0]).toMatchObject({ notes: 'Final', closed: true })
  })

  it('a missing session is a no-op', async () => {
    const store = setup()
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    const before = JSON.stringify(store.sessions)
    expect(() => store.updateSession('nope', DETAILS)).not.toThrow()
    expect(JSON.stringify(store.sessions)).toBe(before)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it.each([
    ['zero', { seriesCount: 0 }],
    ['non-integer', { endsPerSeries: 1.5 }],
    ['negative', { arrowsPerEnd: -3 }],
    ['NaN', { arrowsPerEnd: Number.NaN }],
  ])('ignores the whole structure part when one value is %s', (_, patch) => {
    const store = setup()
    const before = JSON.stringify(store.sessions)
    store.updateSession('s1', { seriesCount: 3, ...patch })
    expect(JSON.stringify(store.sessions)).toBe(before)
  })

  it('ignores an unknown face, a negative or non-finite distance, and non-string fields', () => {
    const store = setup()
    const before = JSON.stringify(store.sessions)
    store.updateSession('s1', { faceId: 'missing-face' })
    store.updateSession('s1', { distance: -1 })
    store.updateSession('s1', { distance: Number.POSITIVE_INFINITY })
    store.updateSession('s1', {
      date: 5,
      location: null,
      notes: 7,
    } as unknown as SessionPatch)
    expect(JSON.stringify(store.sessions)).toBe(before)
  })

  it('the updated session reloads intact from storage (still a valid persisted session)', async () => {
    const store = setup()
    store.updateSession('s1', { ...DETAILS, faceId: '3d', seriesCount: 1, arrowsPerEnd: 2 })
    await nextTick()
    setActivePinia(createPinia())
    const reloaded = useSessionsStore().getSession('s1')!
    expect(reloaded).toMatchObject({ faceId: '3d', seriesCount: 1, arrowsPerEnd: 2 })
    expect(reloaded.archers[0]!.ends).toHaveLength(10)
    expect(reloaded.archers[0]!.ends[0]).toEqual([null, null])
  })
})

describe('deleteSession (CU-12)', () => {
  function setup() {
    const a = makeSession({ id: 'a', date: '2026-10-14' })
    const b = makeSession({ id: 'b', closed: true })
    b.archers[0]!.ends[0] = ['X', '9', '8']
    const c = makeSession({ id: 'c', date: '2026-10-16' })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([a, b, c])))
    return { store: useSessionsStore(), a, b, c }
  }

  it('removes the session with that id', () => {
    const { store } = setup()
    store.deleteSession('a')
    expect(store.getSession('a')).toBeUndefined()
    expect(store.sessions.map((s) => s.id)).toEqual(['b', 'c'])
  })

  it('leaves the other sessions untouched: same values and the same objects', () => {
    const { store, b, c } = setup()
    const keptB = toRaw(store.getSession('b'))
    const keptC = toRaw(store.getSession('c'))
    const array = toRaw(store.sessions)
    store.deleteSession('a')
    expect(store.sessions).toEqual([b, c])
    expect(toRaw(store.getSession('b'))).toBe(keptB)
    expect(toRaw(store.getSession('c'))).toBe(keptC)
    // Spliced in place, not reassigned.
    expect(toRaw(store.sessions)).toBe(array)
  })

  it('persists the deletion through the state watch', async () => {
    const { store } = setup()
    store.deleteSession('c')
    await nextTick()
    expect(stored().sessions.map((s: { id: string }) => s.id)).toEqual(['a', 'b'])
    setActivePinia(createPinia())
    expect(useSessionsStore().getSession('c')).toBeUndefined()
  })

  it('deletes a closed session with its arrows', async () => {
    const { store } = setup()
    store.deleteSession('b')
    expect(store.getSession('b')).toBeUndefined()
    await nextTick()
    expect(stored().sessions.map((s: { id: string }) => s.id)).toEqual(['a', 'c'])
  })

  it('an unknown id is a no-op: nothing changes and nothing is saved', async () => {
    const { store } = setup()
    const before = JSON.stringify(store.sessions)
    await nextTick()
    localStorage.removeItem(STORAGE_KEY)
    expect(() => store.deleteSession('nope')).not.toThrow()
    expect(JSON.stringify(store.sessions)).toBe(before)
    await nextTick()
    expect(stored()).toBeNull()
  })

  it('deleting the only session leaves an empty, persisted list', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState()))
    const store = useSessionsStore()
    store.deleteSession('s1')
    expect(store.sessions).toEqual([])
    expect(store.sortedSessions).toEqual([])
    await nextTick()
    expect(stored()).toEqual(makeState([]))
  })

  it('an export after deleting no longer contains the session', () => {
    const { store } = setup()
    store.deleteSession('b')
    const ids = JSON.parse(store.exportJson()).sessions.map((s: { id: string }) => s.id)
    expect(ids).toEqual(['a', 'c'])
  })

  it('importing a backup made before deleting adds it back as new (CU-15 merge)', async () => {
    const { store, b } = setup()
    const backup = store.exportJson()
    store.deleteSession('b')
    const preview = store.importJson(backup)
    expect(preview).toMatchObject({ ok: true, total: 3, added: 1, updated: 0, unchanged: 2 })
    if (!preview.ok) throw new Error(preview.error)
    expect(preview.apply()).toEqual({ added: 1, updated: 0, unchanged: 2, saved: true })
    expect(store.getSession('b')).toEqual(b)
    await nextTick()
    expect(stored().sessions.map((s: { id: string }) => s.id)).toEqual(['a', 'c', 'b'])
  })
})
