import { describe, expect, it } from 'vitest'

import { firstEmptyCell, nextCell, zonePoints } from './scoring'
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
