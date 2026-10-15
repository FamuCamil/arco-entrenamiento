import { describe, expect, it } from 'vitest'

import { firstEmptyCell, nextCell, sortEnd, zonePoints } from './scoring'
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
