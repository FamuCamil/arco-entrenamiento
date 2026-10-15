import { afterEach, describe, expect, it, vi } from 'vitest'

import { localIsoDate } from './dates'

afterEach(() => {
  vi.useRealTimers()
})

describe('localIsoDate', () => {
  it('formats a date as YYYY-MM-DD with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(localIsoDate(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
  })

  it('uses local time just after midnight', () => {
    expect(localIsoDate(new Date(2026, 9, 15, 0, 0, 1))).toBe('2026-10-15')
  })

  it('uses local time just before midnight', () => {
    expect(localIsoDate(new Date(2026, 9, 15, 23, 59, 59))).toBe('2026-10-15')
  })

  it('does not go through toISOString (UTC)', () => {
    const date = new Date(2026, 9, 15, 0, 30)
    const spy = vi.spyOn(date, 'toISOString')
    localIsoDate(date)
    expect(spy).not.toHaveBeenCalled()
  })

  it('defaults to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 3, 23, 59))
    expect(localIsoDate()).toBe('2026-02-03')
  })
})
