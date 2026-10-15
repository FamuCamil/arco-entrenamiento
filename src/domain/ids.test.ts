import { afterEach, describe, expect, it, vi } from 'vitest'

import { createId } from './ids'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() })
    expect(createId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back to a v4-shaped id from getRandomValues when randomUUID is missing', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array<ArrayBuffer>) => real.getRandomValues(arr),
    })
    const ids = Array.from({ length: 200 }, () => createId())
    for (const id of ids) expect(id).toMatch(UUID_V4)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('sets the version and variant bits even when random bytes are all 0xff', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(0xff),
    })
    expect(createId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('falls back to Math.random + Date.now + counter when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = Array.from({ length: 200 }, () => createId())
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]+-[0-9a-z]*$/)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stays unique without crypto even if Math.random and Date.now repeat', () => {
    vi.stubGlobal('crypto', {})
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const ids = Array.from({ length: 50 }, () => createId())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('produces unique ids with the real crypto', () => {
    const ids = Array.from({ length: 500 }, () => createId())
    expect(new Set(ids).size).toBe(ids.length)
  })
})
