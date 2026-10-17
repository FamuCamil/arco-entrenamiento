import { describe, expect, it } from 'vitest'

import { makeSession, makeState } from '../../tests/fixtures'
import { CURRENT_VERSION, isPersistedState, isRecord, isSession, migrate } from './persistedState'

describe('CURRENT_VERSION', () => {
  it('is 1', () => {
    expect(CURRENT_VERSION).toBe(1)
  })
})

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
    expect(isRecord(1)).toBe(false)
  })
})

describe('migrate', () => {
  it('returns a version 1 state as is (same object)', () => {
    const state = makeState()
    expect(migrate(state)).toBe(state)
  })

  it.each([
    ['version 0', { version: 0, sessions: [] }],
    ['version 2', { version: 2, sessions: [] }],
    ['version "1"', { version: '1', sessions: [] }],
    ['a missing version', { sessions: [] }],
  ])('returns null for %s', (_label, raw) => {
    expect(migrate(raw)).toBeNull()
  })

  it.each([null, [], 'x', 1])('returns null for a non-object (%j)', (raw) => {
    expect(migrate(raw)).toBeNull()
  })
})

describe('isSession', () => {
  it('accepts a valid session', () => {
    expect(isSession(makeSession())).toBe(true)
  })

  it('rejects ends that do not match the structure', () => {
    const rows = makeSession()
    rows.archers[0]!.ends.pop()
    expect(isSession(rows)).toBe(false)
    const arrows = makeSession()
    arrows.archers[0]!.ends[0] = [null, null]
    expect(isSession(arrows)).toBe(false)
  })

  it('rejects a session without archers', () => {
    expect(isSession({ ...makeSession(), archers: [] })).toBe(false)
  })
})

describe('isPersistedState', () => {
  it('accepts a valid state, with or without sessions', () => {
    expect(isPersistedState(makeState())).toBe(true)
    expect(isPersistedState(makeState([]))).toBe(true)
  })

  it('accepts extra top-level fields (e.g. a backup exportedAt)', () => {
    expect(isPersistedState({ ...makeState(), exportedAt: '2026-10-17T00:00:00.000Z' })).toBe(true)
  })

  it.each([
    ['a wrong version', { ...makeState(), version: 2 }],
    ['a missing profileName', { version: 1, sessions: [] }],
    ['a non-string profileName', { ...makeState(), profileName: 3 }],
    ['non-array sessions', { ...makeState(), sessions: {} }],
    ['an invalid session', { ...makeState(), sessions: [{ id: 'x' }] }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isPersistedState(value)).toBe(false)
  })
})
