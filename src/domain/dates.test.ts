import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDisplayDate, localIsoDate } from './dates'

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

describe('formatDisplayDate', () => {
  it('turns YYYY-MM-DD into DD/MM/YYYY', () => {
    expect(formatDisplayDate('2026-10-17')).toBe('17/10/2026')
    expect(formatDisplayDate('2026-01-05')).toBe('05/01/2026')
    expect(formatDisplayDate('2024-02-29')).toBe('29/02/2024')
  })

  it('does not parse a Date (no time-zone shift)', () => {
    const spy = vi.spyOn(globalThis, 'Date')
    formatDisplayDate('2026-01-01')
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns anything else unchanged', () => {
    for (const text of ['', '2026-1-5', '17/10/2026', 'abc', '2026-10-17T00:00']) {
      expect(formatDisplayDate(text)).toBe(text)
    }
  })
})
