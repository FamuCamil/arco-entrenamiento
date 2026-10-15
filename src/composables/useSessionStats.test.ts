import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { isRef } from 'vue'

import type { End, Session } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import { STORAGE_KEY } from './usePersistence'
import { useSessionStats } from './useSessionStats'

function seed(session: Session = makeSession()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
}

/** A 2 series × 2 ends session with the given face, arrows per end and ends. */
function small(faceId: string, arrowsPerEnd: number, ends: End[]): Session {
  const s = makeSession({ faceId, seriesCount: 2, endsPerSeries: 2, arrowsPerEnd })
  s.archers[0]!.ends = ends
  return s
}

const KEYS = [
  'arrowMax',
  'endMax',
  'seriesMax',
  'grandMax',
  'endTotals',
  'runningTotals',
  'seriesTotals',
  'grandTotal',
  'average',
  'averageLabel',
] as const

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('maxima', () => {
  it('WA 40 2×10×3: 10 per arrow, 30 per end, 300 per series, 600 in all', () => {
    seed()
    const s = useSessionStats('s1', 'a1')
    expect(s.arrowMax.value).toBe(10)
    expect(s.endMax.value).toBe(30)
    expect(s.seriesMax.value).toBe(300)
    expect(s.grandMax.value).toBe(600)
  })

  it('field 2 arrows: 6 per arrow, 18 per end (3 arrows) / 12 (2 arrows)', () => {
    seed(makeSession({ faceId: 'wa-field' }))
    expect(useSessionStats('s1', 'a1').endMax.value).toBe(18)
    setActivePinia(createPinia())
    localStorage.clear()
    seed(
      small('wa-field', 2, [
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ]),
    )
    const s = useSessionStats('s1', 'a1')
    expect(s.arrowMax.value).toBe(6)
    expect(s.endMax.value).toBe(12)
    expect(s.seriesMax.value).toBe(24)
    expect(s.grandMax.value).toBe(48)
  })

  it('3D 2 arrows: 11 per arrow, 22 per end', () => {
    seed(
      small('3d', 2, [
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ]),
    )
    const s = useSessionStats('s1', 'a1')
    expect(s.arrowMax.value).toBe(11)
    expect(s.endMax.value).toBe(22)
    expect(s.seriesMax.value).toBe(44)
    expect(s.grandMax.value).toBe(88)
  })

  it('WA 122 2×6×6: 60 per end, 360 per series, 720 in all', () => {
    seed(makeSession({ faceId: 'wa-122', seriesCount: 2, endsPerSeries: 6, arrowsPerEnd: 6 }))
    const s = useSessionStats('s1', 'a1')
    expect(s.endMax.value).toBe(60)
    expect(s.seriesMax.value).toBe(360)
    expect(s.grandMax.value).toBe(720)
  })
})

describe('totals and average', () => {
  const ends = (): End[] => [
    ['X', '9', '8'], // 27
    [null, null, null], // unstarted
    ['M', null, null], // started, 0
    ['10', '6', null], // 16
  ]

  it('row totals and running totals: null for unstarted ends, partial and M-only are numeric', () => {
    seed(small('wa-40', 3, ends()))
    const s = useSessionStats('s1', 'a1')
    expect(s.endTotals.value).toEqual([27, null, 0, 16])
    expect(s.runningTotals.value).toEqual([27, null, 0, 16])
  })

  it('the running total accumulates within a series and resets at the next one', () => {
    seed(
      small('wa-40', 3, [
        ['X', '9', '8'],
        ['7', '7', '7'],
        ['5', null, null],
        ['5', '5', null],
      ]),
    )
    const s = useSessionStats('s1', 'a1')
    expect(s.endTotals.value).toEqual([27, 21, 5, 10])
    expect(s.runningTotals.value).toEqual([27, 48, 5, 15])
  })

  it('a started end after an unstarted one in the same series includes the earlier ends', () => {
    seed(
      small('wa-40', 3, [
        [null, null, null],
        ['9', null, null],
        ['X', null, null],
        [null, null, null],
      ]),
    )
    const s = useSessionStats('s1', 'a1')
    expect(s.runningTotals.value).toEqual([null, 9, 10, null])
  })

  it('series totals and grand total are always numeric', () => {
    seed(small('wa-40', 3, ends()))
    const s = useSessionStats('s1', 'a1')
    expect(s.seriesTotals.value).toEqual([27, 16])
    expect(s.grandTotal.value).toBe(43)
  })

  it('series totals are 0 for an empty session, one per series', () => {
    seed()
    const s = useSessionStats('s1', 'a1')
    expect(s.seriesTotals.value).toEqual([0, 0])
    expect(s.grandTotal.value).toBe(0)
    expect(s.endTotals.value).toHaveLength(20)
    expect(s.endTotals.value.every((v) => v === null)).toBe(true)
    expect(s.runningTotals.value.every((v) => v === null)).toBe(true)
  })

  it('average over arrows shot only, label with a point and 2 decimals', () => {
    seed(small('wa-40', 3, ends()))
    const s = useSessionStats('s1', 'a1')
    // 43 points / 6 arrows = 7.1666…
    expect(s.average.value).toBe(7.17)
    expect(s.averageLabel.value).toBe('Promedio: 7.17')
  })

  it('«Promedio: 8.67» for 26/3', () => {
    seed(
      small('wa-40', 3, [
        ['10', '8', '8'],
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ]),
    )
    expect(useSessionStats('s1', 'a1').averageLabel.value).toBe('Promedio: 8.67')
  })

  it('always 2 decimals: «Promedio: 9.00» and «Promedio: 0.00»', () => {
    seed(
      small('wa-40', 2, [
        ['10', '9'],
        ['8', null],
        [null, null],
        [null, null],
      ]),
    )
    expect(useSessionStats('s1', 'a1').averageLabel.value).toBe('Promedio: 9.00')
    setActivePinia(createPinia())
    localStorage.clear()
    seed(
      small('wa-40', 2, [
        ['M', null],
        [null, null],
        [null, null],
        [null, null],
      ]),
    )
    expect(useSessionStats('s1', 'a1').averageLabel.value).toBe('Promedio: 0.00')
  })

  it('«Promedio: —» with no arrows shot', () => {
    seed()
    const s = useSessionStats('s1', 'a1')
    expect(s.average.value).toBeNull()
    expect(s.averageLabel.value).toBe('Promedio: —')
  })

  it('uses the face points: field X = 6, 3D 11', () => {
    seed(
      small('wa-field', 2, [
        ['X', '6'],
        [null, null],
        ['X', '1'],
        [null, null],
      ]),
    )
    let s = useSessionStats('s1', 'a1')
    expect(s.endTotals.value).toEqual([12, null, 7, null])
    expect(s.grandTotal.value).toBe(19)
    expect(s.averageLabel.value).toBe('Promedio: 4.75')

    setActivePinia(createPinia())
    localStorage.clear()
    seed(
      small('3d', 2, [
        ['11', '5'],
        ['10', 'M'],
        [null, null],
        [null, null],
      ]),
    )
    s = useSessionStats('s1', 'a1')
    expect(s.endTotals.value).toEqual([16, 10, null, null])
    expect(s.runningTotals.value).toEqual([16, 26, null, null])
    expect(s.seriesTotals.value).toEqual([26, 0])
    expect(s.averageLabel.value).toBe('Promedio: 6.50')
  })
})

describe('reactivity (AC10)', () => {
  /** 1 series × 3 ends × 3 arrows on WA 40. */
  function seedOne(ends?: End[]) {
    const s = makeSession({ seriesCount: 1, endsPerSeries: 3, arrowsPerEnd: 3 })
    if (ends) s.archers[0]!.ends = ends
    seed(s)
  }

  it('recomputes after scoring and correcting an arrow', () => {
    seedOne()
    const store = useSessionsStore()
    const s = useSessionStats('s1', 'a1')
    expect(s.averageLabel.value).toBe('Promedio: —')

    store.setArrow('s1', 'a1', 0, 0, 'X')
    store.setArrow('s1', 'a1', 0, 1, '9')
    expect(s.endTotals.value).toEqual([19, null, null])
    expect(s.runningTotals.value).toEqual([19, null, null])
    expect(s.grandTotal.value).toBe(19)
    expect(s.averageLabel.value).toBe('Promedio: 9.50')

    store.setArrow('s1', 'a1', 0, 1, '5')
    expect(s.endTotals.value).toEqual([15, null, null])
    expect(s.seriesTotals.value).toEqual([15])
    expect(s.averageLabel.value).toBe('Promedio: 7.50')
  })

  it('recomputes after deleting an arrow; deleting the last one blanks the row', () => {
    seedOne([
      ['X', '9', '8'],
      ['7', null, null],
      [null, null, null],
    ])
    const store = useSessionsStore()
    const s = useSessionStats('s1', 'a1')
    expect(s.runningTotals.value).toEqual([27, 34, null])

    store.setArrow('s1', 'a1', 0, 1, null)
    expect(s.endTotals.value).toEqual([18, 7, null])
    expect(s.runningTotals.value).toEqual([18, 25, null])
    expect(s.grandTotal.value).toBe(25)
    expect(s.averageLabel.value).toBe('Promedio: 8.33')

    store.setArrow('s1', 'a1', 1, 0, null)
    expect(s.endTotals.value).toEqual([18, null, null])
    expect(s.runningTotals.value).toEqual([18, null, null])
  })

  it('recomputes after deleting an end', () => {
    seedOne([
      ['X', '9', '8'],
      ['7', '7', null],
      [null, null, null],
    ])
    const store = useSessionsStore()
    const s = useSessionStats('s1', 'a1')
    store.deleteEnd('s1', 'a1', 0)
    expect(s.endTotals.value).toEqual([null, 14, null])
    expect(s.runningTotals.value).toEqual([null, 14, null])
    expect(s.grandTotal.value).toBe(14)
    expect(s.averageLabel.value).toBe('Promedio: 7.00')

    store.deleteEnd('s1', 'a1', 1)
    expect(s.grandTotal.value).toBe(0)
    expect(s.averageLabel.value).toBe('Promedio: —')
  })

  it('a completing write that sorts the end keeps the totals right', () => {
    seedOne()
    const store = useSessionsStore()
    const s = useSessionStats('s1', 'a1')
    store.setArrow('s1', 'a1', 0, 0, '7')
    store.setArrow('s1', 'a1', 0, 1, 'M')
    store.setArrow('s1', 'a1', 0, 2, 'X')
    expect(store.getArcher('s1', 'a1')!.ends[0]).toEqual(['X', '7', 'M'])
    expect(s.endTotals.value).toEqual([17, null, null])
    expect(s.averageLabel.value).toBe('Promedio: 5.67')
  })
})

describe('derived only', () => {
  it('exposes every value as a computed ref', () => {
    seed()
    const s = useSessionStats('s1', 'a1')
    expect(Object.keys(s).sort()).toEqual([...KEYS].sort())
    for (const key of KEYS) expect(isRef(s[key])).toBe(true)
  })

  it('writes nothing to the store or to the persisted state', () => {
    seed(
      small('wa-40', 3, [
        ['X', '9', '8'],
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ]),
    )
    const before = localStorage.getItem(STORAGE_KEY)
    const store = useSessionsStore()
    const snapshot = JSON.stringify(store.getSession('s1'))
    const s = useSessionStats('s1', 'a1')
    for (const key of KEYS) void s[key].value
    expect(JSON.stringify(store.getSession('s1'))).toBe(snapshot)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    const stored = localStorage.getItem(STORAGE_KEY)!
    for (const word of ['endTotal', 'average', 'Promedio', 'grandTotal']) {
      expect(stored).not.toContain(word)
    }
  })
})

describe('defaults', () => {
  function expectDefaults(s: ReturnType<typeof useSessionStats>) {
    expect(s.arrowMax.value).toBe(0)
    expect(s.endMax.value).toBe(0)
    expect(s.seriesMax.value).toBe(0)
    expect(s.grandMax.value).toBe(0)
    expect(s.endTotals.value).toEqual([])
    expect(s.runningTotals.value).toEqual([])
    expect(s.seriesTotals.value).toEqual([])
    expect(s.grandTotal.value).toBe(0)
    expect(s.average.value).toBeNull()
    expect(s.averageLabel.value).toBe('Promedio: —')
  }

  it('an unknown session', () => {
    seed()
    expectDefaults(useSessionStats('nope', 'a1'))
  })

  it('an unknown archer', () => {
    seed()
    const s = useSessionStats('s1', 'nope')
    expect(s.endTotals.value).toEqual([])
    expect(s.seriesTotals.value).toEqual([])
    expect(s.grandTotal.value).toBe(0)
    expect(s.grandMax.value).toBe(0)
    expect(s.averageLabel.value).toBe('Promedio: —')
  })

  it('an unknown face: no maxima, totals or average, rows stay blank', () => {
    const session = makeSession({ faceId: 'nope', seriesCount: 1, endsPerSeries: 2 })
    session.archers[0]!.ends = [
      ['X', '9', '8'],
      [null, null, null],
    ]
    seed(session)
    const s = useSessionStats('s1', 'a1')
    expect(s.arrowMax.value).toBe(0)
    expect(s.endMax.value).toBe(0)
    expect(s.endTotals.value).toEqual([null, null])
    expect(s.runningTotals.value).toEqual([null, null])
    expect(s.seriesTotals.value).toEqual([0])
    expect(s.grandTotal.value).toBe(0)
    expect(s.average.value).toBeNull()
  })
})
