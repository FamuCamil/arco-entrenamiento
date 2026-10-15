import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSession, makeState } from '../../tests/fixtures'
import {
  CORRUPT_KEY,
  STORAGE_KEY,
  emptyState,
  load,
  migrate,
  requestPersistentStorage,
  save,
  usePersistence,
} from './usePersistence'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function seed(value: unknown): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  localStorage.setItem(STORAGE_KEY, raw)
  return raw
}

describe('keys and empty state', () => {
  it('uses the archery-training:v1 key and a side key for corrupt data', () => {
    expect(STORAGE_KEY).toBe('archery-training:v1')
    expect(CORRUPT_KEY).toBe('archery-training:v1:corrupt')
  })

  it('emptyState has the persisted shape and is a fresh object each time', () => {
    expect(emptyState()).toEqual({ version: 1, sessions: [], profileName: '' })
    expect(emptyState()).not.toBe(emptyState())
  })

  it('usePersistence exposes load, save, migrate and requestPersistentStorage', () => {
    expect(usePersistence()).toEqual({ load, save, migrate, requestPersistentStorage })
  })
})

describe('save + load', () => {
  it('round-trips the state under STORAGE_KEY with shape { version, sessions, profileName }', () => {
    const state = makeState()
    state.sessions[0]!.archers[0]!.ends[0] = ['X', '9', 'M']
    state.profileName = 'Ana'
    expect(save(state)).toBe(true)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(Object.keys(stored).sort()).toEqual(['profileName', 'sessions', 'version'])
    expect(stored.version).toBe(1)
    expect(load()).toEqual(state)
  })

  it('returns the empty state when nothing is stored, without writing the corrupt key', () => {
    expect(load()).toEqual(emptyState())
    expect(localStorage.getItem(CORRUPT_KEY)).toBeNull()
  })

  it('accepts an empty sessions list', () => {
    seed(makeState([]))
    expect(load()).toEqual(makeState([]))
  })
})

describe('load with unusable storage', () => {
  it('returns the empty state when accessing window.localStorage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(load()).toEqual(emptyState())
  })

  it('returns the empty state when localStorage is missing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined as unknown as Storage)
    expect(load()).toEqual(emptyState())
  })

  it('returns the empty state when getItem throws', () => {
    seed(makeState())
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(load()).toEqual(emptyState())
  })
})

describe('load with corrupt contents', () => {
  const cases: [string, unknown][] = [
    ['invalid JSON', '{not json'],
    ['a JSON array', '[]'],
    ['a JSON null', 'null'],
    ['a missing version', { sessions: [], profileName: '' }],
    ['an unknown version', { version: 2, sessions: [], profileName: '' }],
    ['sessions that is not an array', { version: 1, sessions: {}, profileName: '' }],
    ['a non-string profileName', { version: 1, sessions: [], profileName: 3 }],
    ['a session missing its id', makeState([{ ...makeSession(), id: 4 as unknown as string }])],
    ['a negative distance', makeState([makeSession({ distance: -1 })])],
    ['a non-finite distance', { ...makeState(), sessions: [{ ...makeSession(), distance: null }] }],
    ['zero seriesCount', makeState([makeSession({ seriesCount: 0 })])],
    ['fractional endsPerSeries', makeState([{ ...makeSession(), endsPerSeries: 1.5 }])],
    ['a non-boolean closed', makeState([{ ...makeSession(), closed: 'no' as unknown as boolean }])],
    ['a negative createdAt', makeState([makeSession({ createdAt: -5 })])],
    ['no archers', makeState([makeSession({ archers: [] })])],
    [
      'archers that is not an array',
      { ...makeState(), sessions: [{ ...makeSession(), archers: 1 }] },
    ],
  ]

  it.each(cases)('%s gives the empty state and preserves the raw value', (_, value) => {
    const raw = seed(value)
    expect(load()).toEqual(emptyState())
    expect(localStorage.getItem(CORRUPT_KEY)).toBe(raw)
  })

  function withArcher(patch: Record<string, unknown>) {
    const s = makeSession()
    return makeState([{ ...s, archers: [{ ...s.archers[0]!, ...patch }] }])
  }

  const archerCases: [string, Record<string, unknown>][] = [
    ['a non-string archer name', { name: 1 }],
    ['an invalid position', { position: 'E' }],
    ['ends that is not an array', { ends: 'x' }],
    ['the wrong number of ends (≠ seriesCount × endsPerSeries)', { ends: [[null, null, null]] }],
    [
      'an end of the wrong length',
      { ends: Array.from({ length: 20 }, (_, i) => (i === 7 ? [null, null] : [null, null, null])) },
    ],
    [
      'a non-string, non-null arrow',
      {
        ends: Array.from({ length: 20 }, (_, i) =>
          i === 3 ? [null, 9, null] : [null, null, null],
        ),
      },
    ],
  ]

  it.each(archerCases)('%s gives the empty state', (_, patch) => {
    const raw = seed(withArcher(patch))
    expect(load()).toEqual(emptyState())
    expect(localStorage.getItem(CORRUPT_KEY)).toBe(raw)
  })

  it('drops the whole state when one of several sessions is invalid', () => {
    seed(makeState([makeSession({ id: 'ok' }), makeSession({ id: 'bad', faceId: 7 as never })]))
    expect(load().sessions).toEqual([])
  })

  it('accepts every archer position A-D', () => {
    const s = makeSession()
    const archers = (['A', 'B', 'C', 'D'] as const).map((position, i) => ({
      ...s.archers[0]!,
      id: `a${i}`,
      position,
    }))
    seed(makeState([{ ...s, archers }]))
    expect(load().sessions[0]!.archers).toHaveLength(4)
  })

  it('still returns the empty state when the corrupt copy cannot be written', () => {
    seed('{not json')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(load()).toEqual(emptyState())
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not json')
  })
})

describe('migrate', () => {
  it('passes version 1 through', () => {
    const state = makeState()
    expect(migrate(state)).toBe(state)
  })

  it('returns null for unknown, missing or non-object input', () => {
    expect(migrate({ version: 0 })).toBeNull()
    expect(migrate({})).toBeNull()
    expect(migrate(null)).toBeNull()
    expect(migrate('x')).toBeNull()
    expect(migrate([1])).toBeNull()
  })
})

describe('save failures', () => {
  it('returns false and does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(save(makeState())).toBe(false)
  })

  it('returns false when localStorage is unavailable', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(save(makeState())).toBe(false)
  })
})

describe('requestPersistentStorage', () => {
  it('calls navigator.storage.persist when present', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('tolerates a missing navigator.storage', async () => {
    vi.stubGlobal('navigator', {})
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })

  it('tolerates a missing persist method', async () => {
    vi.stubGlobal('navigator', { storage: {} })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })

  it('tolerates a missing navigator', async () => {
    vi.stubGlobal('navigator', undefined)
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })

  it('swallows a rejection', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockRejectedValue(new Error('no')) } })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })

  it('swallows a synchronous throw', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: () => {
          throw new Error('sync')
        },
      },
    })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })
})
