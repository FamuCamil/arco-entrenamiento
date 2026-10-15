import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { STORAGE_KEY } from '@/composables/usePersistence'
import { makeSession, makeState } from '../../tests/fixtures'
import { DEFAULT_ARCHER_NAME, useSessionsStore, type SessionInput } from './sessions'

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

  it('is a no-op when the session face is unknown', () => {
    const { store, ends } = setup({ faceId: 'missing-face' })
    store.setArrow('s1', 'a1', 0, 0, 'X')
    expect(ends()[0]).toEqual([null, null, null])
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
