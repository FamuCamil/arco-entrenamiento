import { describe, expect, it } from 'vitest'

import {
  averagePerArrow,
  endTotal,
  firstEmptyCell,
  grandTotal,
  maxArrowPoints,
  nextCell,
  seriesRunningTotal,
  seriesTotal,
  sortEnd,
  zonePoints,
} from './scoring'
import { getTargetFace } from './targetFaces'
import type { End, TargetFace } from './types'

function face(id: string): TargetFace {
  const f = getTargetFace(id)
  if (!f) throw new Error(`missing face ${id}`)
  return f
}

function sum(keys: string[], f: TargetFace): number {
  return keys.reduce((total, key) => total + zonePoints(key, f), 0)
}

describe('zonePoints', () => {
  it('X, 9, M on WA 40 add up to 19', () => {
    expect(sum(['X', '9', 'M'], face('wa-40'))).toBe(19)
  })

  it('X, 6 on the field face add up to 12', () => {
    expect(sum(['X', '6'], face('wa-field'))).toBe(12)
  })

  it('11, 5 on 3D add up to 16', () => {
    expect(sum(['11', '5'], face('3d'))).toBe(16)
  })

  it('returns each zone points on WA 40', () => {
    const f = face('wa-40')
    expect(zonePoints('X', f)).toBe(10)
    expect(zonePoints('10', f)).toBe(10)
    expect(zonePoints('1', f)).toBe(1)
    expect(zonePoints('M', f)).toBe(0)
  })

  it('returns 0 for an empty cell', () => {
    expect(zonePoints(null, face('wa-40'))).toBe(0)
  })

  it('returns 0 for a key that is not on the face', () => {
    expect(zonePoints('11', face('wa-40'))).toBe(0)
    expect(zonePoints('4', face('wa-40-triple'))).toBe(0)
    expect(zonePoints('', face('3d'))).toBe(0)
  })
})

describe('firstEmptyCell', () => {
  it('returns {0,0} for an empty matrix', () => {
    expect(firstEmptyCell([])).toEqual({ row: 0, col: 0 })
  })

  it('returns {0,0} for an all-empty matrix', () => {
    expect(
      firstEmptyCell([
        [null, null, null],
        [null, null, null],
      ]),
    ).toEqual({ row: 0, col: 0 })
  })

  it('finds the first gap in row-major order', () => {
    const ends: End[] = [
      ['X', '9', '8'],
      ['7', null, '5'],
      [null, null, null],
    ]
    expect(firstEmptyCell(ends)).toEqual({ row: 1, col: 1 })
  })

  it('finds a gap at the start of a later row', () => {
    const ends: End[] = [
      ['X', '9', '8'],
      [null, null, null],
    ]
    expect(firstEmptyCell(ends)).toEqual({ row: 1, col: 0 })
  })

  it('returns the last cell when the matrix is full', () => {
    const ends: End[] = [
      ['X', '9', '8'],
      ['7', '6', 'M'],
    ]
    expect(firstEmptyCell(ends)).toEqual({ row: 1, col: 2 })
  })

  it('returns {row, 0} for a full matrix whose last row is empty-length', () => {
    expect(firstEmptyCell([['X'], []])).toEqual({ row: 1, col: 0 })
  })
})

describe('nextCell', () => {
  const ends: End[] = [
    [null, null, null],
    [null, null, null],
  ]

  it('moves to the next arrow within the row', () => {
    expect(nextCell({ row: 0, col: 0 }, ends)).toEqual({ row: 0, col: 1 })
    expect(nextCell({ row: 1, col: 1 }, ends)).toEqual({ row: 1, col: 2 })
  })

  it('wraps from the last arrow of a row to the first of the next row', () => {
    expect(nextCell({ row: 0, col: 2 }, ends)).toEqual({ row: 1, col: 0 })
  })

  it('stays put at the last cell of the session', () => {
    expect(nextCell({ row: 1, col: 2 }, ends)).toEqual({ row: 1, col: 2 })
  })

  it('does not depend on cell contents', () => {
    const full: End[] = [
      ['X', '9', '8'],
      ['7', '6', '5'],
    ]
    expect(nextCell({ row: 0, col: 2 }, full)).toEqual({ row: 1, col: 0 })
  })

  it('returns a new object rather than the input cell', () => {
    const last = { row: 1, col: 2 }
    const next = nextCell(last, ends)
    expect(next).toEqual(last)
    expect(next).not.toBe(last)
  })

  it('stays put on an out-of-range row', () => {
    expect(nextCell({ row: 5, col: 0 }, ends)).toEqual({ row: 5, col: 0 })
  })
})

describe('sortEnd', () => {
  /** A face built from (key, order) pairs; zones listed in the given sequence. */
  function customFace(spec: [key: string, order: number][]): TargetFace {
    return {
      id: 'custom',
      name: 'Custom',
      icon: 'wa-full',
      zones: spec.map(([key, order]) => ({ key, points: 0, order, bg: '#000', fg: '#fff' })),
    }
  }

  it('sorts a WA 40 end best-to-worst: 7, M, X, 10 → X, 10, 7, M', () => {
    expect(sortEnd(['7', 'M', 'X', '10'], face('wa-40'))).toEqual(['X', '10', '7', 'M'])
  })

  it('sorts a 3D end: 5, 11, M, 8 → 11, 8, 5, M', () => {
    expect(sortEnd(['5', '11', 'M', '8'], face('3d'))).toEqual(['11', '8', '5', 'M'])
  })

  it('sorts a field end: 3, X, 6 → X, 6, 3', () => {
    expect(sortEnd(['3', 'X', '6'], face('wa-field'))).toEqual(['X', '6', '3'])
  })

  it('puts empties last', () => {
    expect(sortEnd([null, '7', 'X'], face('wa-40'))).toEqual(['X', '7', null])
    expect(sortEnd([null, 'M', null, '9'], face('wa-40'))).toEqual(['9', 'M', null, null])
  })

  it('does not mutate the input and returns a new array', () => {
    const end: End = ['7', 'M', 'X']
    const sorted = sortEnd(end, face('wa-40'))
    expect(end).toEqual(['7', 'M', 'X'])
    expect(sorted).not.toBe(end)
    expect(sorted).toEqual(['X', '7', 'M'])
  })

  it('returns a new array even when the end is already sorted', () => {
    const end: End = ['X', '9', 'M']
    const sorted = sortEnd(end, face('wa-40'))
    expect(sorted).toEqual(end)
    expect(sorted).not.toBe(end)
  })

  it('is stable for equal keys and for zones that share an order', () => {
    expect(sortEnd(['9', 'X', '9'], face('wa-40'))).toEqual(['X', '9', '9'])
    const tied = customFace([
      ['A', 0],
      ['B', 0],
    ])
    expect(sortEnd(['B', 'A'], tied)).toEqual(['B', 'A'])
    expect(sortEnd(['A', 'B'], tied)).toEqual(['A', 'B'])
  })

  it('sorts by zone order, not by key text', () => {
    // Text order would give 1, M, X; zone order gives X, 1, M.
    expect(sortEnd(['M', 'X', '1'], face('wa-40'))).toEqual(['X', '1', 'M'])
    expect(sortEnd(['5', '10', '8'], face('3d'))).toEqual(['10', '8', '5'])
    // A face whose order is the reverse of its key text order.
    const reversed = customFace([
      ['c', 0],
      ['b', 1],
      ['a', 2],
    ])
    expect(sortEnd(['a', 'b', 'c'], reversed)).toEqual(['c', 'b', 'a'])
  })

  it('reads the order field, not the zone position in the array', () => {
    const shuffled = customFace([
      ['low', 2],
      ['high', 0],
      ['mid', 1],
    ])
    expect(sortEnd(['low', 'mid', 'high'], shuffled)).toEqual(['high', 'mid', 'low'])
  })

  it('puts a key that is not on the face after the known keys and before the empties', () => {
    expect(sortEnd([null, '11', 'M', 'X'], face('wa-40'))).toEqual(['X', 'M', '11', null])
  })

  it('keeps several unknown keys in their relative order', () => {
    expect(sortEnd(['q', null, 'p', '9'], face('wa-40'))).toEqual(['9', 'q', 'p', null])
  })

  it('returns [] for an empty end', () => {
    expect(sortEnd([], face('wa-40'))).toEqual([])
  })

  it('leaves an all-empty end all-empty', () => {
    expect(sortEnd([null, null, null], face('wa-40'))).toEqual([null, null, null])
  })
})

describe('maxArrowPoints', () => {
  it('is 10 on WA 40, 6 on the field face and 11 on 3D', () => {
    expect(maxArrowPoints(face('wa-40'))).toBe(10)
    expect(maxArrowPoints(face('wa-field'))).toBe(6)
    expect(maxArrowPoints(face('3d'))).toBe(11)
  })

  it('is 10 on the reduced WA faces too', () => {
    expect(maxArrowPoints(face('wa-80-6'))).toBe(10)
    expect(maxArrowPoints(face('wa-40-triple'))).toBe(10)
  })

  it('is 0 for a face with no zones', () => {
    expect(maxArrowPoints({ ...face('wa-40'), zones: [] })).toBe(0)
  })
})

describe('endTotal', () => {
  it("['X','9','M'] on WA 40 is 19", () => {
    expect(endTotal(['X', '9', 'M'], face('wa-40'))).toBe(19)
  })

  it("['X','6',null] on the field face is 12 (X = 6, empty = 0)", () => {
    expect(endTotal(['X', '6', null], face('wa-field'))).toBe(12)
  })

  it("['11','5'] on 3D is 16", () => {
    expect(endTotal(['11', '5'], face('3d'))).toBe(16)
  })

  it('an empty end and an all-M end are 0', () => {
    expect(endTotal([null, null, null], face('wa-40'))).toBe(0)
    expect(endTotal(['M', 'M', 'M'], face('wa-40'))).toBe(0)
    expect(endTotal([], face('wa-40'))).toBe(0)
  })

  it('a full end of the best zone equals the end maximum', () => {
    const f = face('wa-122')
    expect(endTotal(['X', 'X', 'X', 'X', 'X', 'X'], f)).toBe(6 * maxArrowPoints(f))
  })

  it('unknown keys count 0', () => {
    expect(endTotal(['11', '9'], face('wa-field'))).toBe(0)
  })
})

/** 2 series × 3 ends × 3 arrows on WA 40. */
const twoSeries = (): End[] => [
  ['10', '9', '8'], // 27
  ['X', null, null], // 10
  [null, null, null], // 0
  ['7', '7', '7'], // 21
  ['M', '1', null], // 1
  ['5', '5', '5'], // 15
]

describe('seriesRunningTotal', () => {
  const f = face('wa-40')

  it('sums from the first end of the series up to the row, inclusive', () => {
    const e = twoSeries()
    expect([0, 1, 2].map((r) => seriesRunningTotal(e, r, 3, f))).toEqual([27, 37, 37])
  })

  it('starts fresh at the first end of the next series', () => {
    const e = twoSeries()
    expect([3, 4, 5].map((r) => seriesRunningTotal(e, r, 3, f))).toEqual([21, 22, 37])
  })

  it('row 10 of a 2×10 session starts series 2 afresh', () => {
    const e: End[] = Array.from({ length: 20 }, () => ['X', 'X', 'X'])
    expect(seriesRunningTotal(e, 9, 10, f)).toBe(300)
    expect(seriesRunningTotal(e, 10, 10, f)).toBe(30)
    expect(seriesRunningTotal(e, 19, 10, f)).toBe(300)
  })

  it('uses the face points (field X = 6, 3D 11)', () => {
    expect(
      seriesRunningTotal(
        [
          ['X', '6'],
          ['X', '5'],
        ],
        1,
        2,
        face('wa-field'),
      ),
    ).toBe(23)
    expect(
      seriesRunningTotal(
        [
          ['11', '11'],
          ['10', 'M'],
        ],
        1,
        2,
        face('3d'),
      ),
    ).toBe(32)
  })

  it('is 0 for a row out of range, a non-integer row or endsPerSeries < 1', () => {
    const e = twoSeries()
    expect(seriesRunningTotal(e, -1, 3, f)).toBe(0)
    expect(seriesRunningTotal(e, 6, 3, f)).toBe(0)
    expect(seriesRunningTotal(e, 1.5, 3, f)).toBe(0)
    expect(seriesRunningTotal(e, 1, 0, f)).toBe(0)
    expect(seriesRunningTotal([], 0, 3, f)).toBe(0)
  })
})

describe('seriesTotal', () => {
  const f = face('wa-40')

  it('totals each series', () => {
    const e = twoSeries()
    expect(seriesTotal(e, 0, 3, f)).toBe(37)
    expect(seriesTotal(e, 1, 3, f)).toBe(37)
  })

  it('a full series of X reaches the series maximum endsPerSeries × arrowsPerEnd × max', () => {
    const e: End[] = Array.from({ length: 20 }, () => ['X', 'X', 'X'])
    expect(seriesTotal(e, 0, 10, f)).toBe(10 * 3 * maxArrowPoints(f))
    expect(seriesTotal(e, 1, 10, f)).toBe(300)
  })

  it('uses the face points on field and 3D', () => {
    expect(
      seriesTotal(
        [
          ['X', 'X'],
          ['6', '1'],
        ],
        0,
        2,
        face('wa-field'),
      ),
    ).toBe(19)
    expect(
      seriesTotal(
        [
          ['11', '8'],
          ['5', null],
        ],
        0,
        2,
        face('3d'),
      ),
    ).toBe(24)
  })

  it('is 0 for a series out of range, a non-integer series or endsPerSeries < 1', () => {
    const e = twoSeries()
    expect(seriesTotal(e, 2, 3, f)).toBe(0)
    expect(seriesTotal(e, -1, 3, f)).toBe(0)
    expect(seriesTotal(e, 0.5, 3, f)).toBe(0)
    expect(seriesTotal(e, 0, 0, f)).toBe(0)
  })
})

describe('grandTotal', () => {
  it('totals every end of the session', () => {
    expect(grandTotal(twoSeries(), face('wa-40'))).toBe(74)
  })

  it('equals the sum of the series totals', () => {
    const e = twoSeries()
    const f = face('wa-40')
    expect(grandTotal(e, f)).toBe(seriesTotal(e, 0, 3, f) + seriesTotal(e, 1, 3, f))
  })

  it('a full session of the best zone reaches rows × arrowsPerEnd × max', () => {
    const e: End[] = Array.from({ length: 20 }, () => ['X', 'X', 'X'])
    expect(grandTotal(e, face('wa-40'))).toBe(20 * 3 * 10)
  })

  it('uses the face points on field and 3D', () => {
    expect(
      grandTotal(
        [
          ['X', '6'],
          ['X', null],
        ],
        face('wa-field'),
      ),
    ).toBe(18)
    expect(
      grandTotal(
        [
          ['11', '5'],
          ['10', '8'],
        ],
        face('3d'),
      ),
    ).toBe(34)
  })

  it('is 0 for no ends', () => {
    expect(grandTotal([], face('wa-40'))).toBe(0)
  })
})

describe('averagePerArrow', () => {
  it("[['10','9'],['8',null]] on WA 40 is 9.00 (only arrows shot count)", () => {
    expect(
      averagePerArrow(
        [
          ['10', '9'],
          ['8', null],
        ],
        face('wa-40'),
      ),
    ).toBe(9)
  })

  it('rounds to 2 decimals: 26/3 is 8.67', () => {
    expect(averagePerArrow([['10', '8', '8']], face('wa-40'))).toBe(8.67)
  })

  it('rounds half up: 29/8 = 3.625 is 3.63', () => {
    const e: End[] = [['10', '9', '5', '5', 'M', 'M', 'M', 'M']]
    expect(averagePerArrow(e, face('wa-40'))).toBe(3.63)
  })

  it('a miss counts as an arrow shot (0 points)', () => {
    expect(averagePerArrow([['10', 'M', null]], face('wa-40'))).toBe(5)
  })

  it('is null when nothing was shot', () => {
    expect(averagePerArrow([[null, null, null]], face('wa-40'))).toBeNull()
    expect(averagePerArrow([], face('wa-40'))).toBeNull()
  })

  it('uses the face points on field (X = 6) and 3D (11)', () => {
    expect(averagePerArrow([['X', '5', null]], face('wa-field'))).toBe(5.5)
    expect(
      averagePerArrow(
        [
          ['11', '8'],
          ['5', null],
        ],
        face('3d'),
      ),
    ).toBe(8)
  })
})
