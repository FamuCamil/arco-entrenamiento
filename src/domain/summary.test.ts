import { describe, expect, it } from 'vitest'

import { tiebreakCounts, tiebreakPoints, tiebreakTable, zoneDistribution } from './summary'
import { getTargetFace } from './targetFaces'
import type { End, ScoringZone, TargetFace } from './types'

function face(id: string): TargetFace {
  const f = getTargetFace(id)
  if (!f) throw new Error(`missing face ${id}`)
  return f
}

function emptyEnds(rows: number, arrows: number): End[] {
  return Array.from({ length: rows }, () => Array.from({ length: arrows }, () => null))
}

/** A synthetic face built from [key, points] pairs (colors are irrelevant here). */
function synthetic(spec: [string, number][]): TargetFace {
  const zones: ScoringZone[] = spec.map(([key, points], order) => ({
    key,
    points,
    order,
    bg: '#ffffff',
    fg: '#111827',
  }))
  return { id: 'synthetic', name: 'Synthetic', icon: 'wa-full', zones }
}

const counts = (dist: ReturnType<typeof zoneDistribution>) =>
  Object.fromEntries(dist.map(({ zone, count }) => [zone.key, count]))

describe('tiebreakPoints', () => {
  it.each([
    ['wa-40', [10, 9]],
    ['wa-122', [10, 9]],
    ['wa-80-6', [10, 9]],
    ['wa-40-triple', [10, 9]],
    ['wa-field', [6, 5]],
    ['3d', [11, 10]],
  ])('%s → %j (from points, not keys)', (id, expected) => {
    expect(tiebreakPoints(face(id))).toEqual(expected)
  })

  it('never includes M (0 points)', () => {
    for (const id of ['wa-40', 'wa-field', '3d']) expect(tiebreakPoints(face(id))).not.toContain(0)
  })

  it('a face with one positive value returns only it', () => {
    expect(
      tiebreakPoints(
        synthetic([
          ['A', 5],
          ['B', 5],
          ['M', 0],
        ]),
      ),
    ).toEqual([5])
  })

  it('a face with only M returns no columns', () => {
    expect(tiebreakPoints(synthetic([['M', 0]]))).toEqual([])
  })

  it('sorts descending regardless of catalogue order', () => {
    expect(
      tiebreakPoints(
        synthetic([
          ['a', 3],
          ['b', 7],
          ['c', 5],
          ['M', 0],
        ]),
      ),
    ).toEqual([7, 5])
  })
})

describe('tiebreakCounts', () => {
  it('WA 40: X counts in «10», 9 in «9», others in neither', () => {
    const f = face('wa-40')
    const ends: End[] = [
      ['X', '10', '9'],
      ['X', '8', 'M'],
    ]
    expect(tiebreakCounts(ends, f, [10, 9])).toEqual([3, 1])
  })

  it('field: X (6 points) counts in «6» with the 6', () => {
    const f = face('wa-field')
    expect(tiebreakCounts([['X', '6', '5', '4']], f, [6, 5])).toEqual([2, 1])
  })

  it('3D: 11 and 10 are separate columns; 8 and 5 count in neither', () => {
    const f = face('3d')
    expect(tiebreakCounts([['11', '10', '10', '8', '5', 'M']], f, [11, 10])).toEqual([1, 2])
  })

  it('3D zones sharing points share a column', () => {
    const f = synthetic([
      ['body', 8],
      ['head', 8],
      ['leg', 5],
      ['M', 0],
    ])
    expect(tiebreakCounts([['body', 'head', 'leg', 'M']], f, tiebreakPoints(f))).toEqual([2, 1])
  })

  it('empty cells and unknown keys never count', () => {
    const f = face('wa-40')
    expect(tiebreakCounts([[null, 'nope', 'X']], f, [10, 9])).toEqual([1, 0])
  })

  it('no columns → empty counts', () => {
    expect(tiebreakCounts([['X']], face('wa-40'), [])).toEqual([])
  })
})

describe('tiebreakTable', () => {
  it('WA 40 2×10×3 empty: all zeros per end, per series and in total', () => {
    const t = tiebreakTable(emptyEnds(20, 3), 10, face('wa-40'))
    expect(t.points).toEqual([10, 9])
    expect(t.perEnd).toHaveLength(20)
    for (const row of t.perEnd) expect(row).toEqual([0, 0])
    expect(t.perSeries).toEqual([
      [0, 0],
      [0, 0],
    ])
    expect(t.total).toEqual([0, 0])
  })

  it('WA 40 partial: per end, per series (floor(row / endsPerSeries)) and total', () => {
    const ends = emptyEnds(20, 3)
    ends[0] = ['X', '10', '9']
    ends[1] = ['9', '9', null]
    ends[10] = ['X', 'X', '8']
    const t = tiebreakTable(ends, 10, face('wa-40'))
    expect(t.perEnd[0]).toEqual([2, 1])
    expect(t.perEnd[1]).toEqual([0, 2])
    expect(t.perEnd[2]).toEqual([0, 0])
    expect(t.perEnd[10]).toEqual([2, 0])
    expect(t.perSeries).toEqual([
      [2, 3],
      [2, 0],
    ])
    expect(t.total).toEqual([4, 3])
  })

  it('WA 80 reducida full of X: everything in «10»', () => {
    const ends = Array.from({ length: 12 }, () => ['X', 'X', 'X'])
    const t = tiebreakTable(ends, 6, face('wa-80-6'))
    expect(t.points).toEqual([10, 9])
    expect(t.perSeries).toEqual([
      [18, 0],
      [18, 0],
    ])
    expect(t.total).toEqual([36, 0])
  })

  it('field full: X and 6 in «6», 5 in «5»', () => {
    const ends = Array.from({ length: 4 }, () => ['X', '6', '5', '1'])
    const t = tiebreakTable(ends, 2, face('wa-field'))
    expect(t.points).toEqual([6, 5])
    expect(t.perEnd[3]).toEqual([2, 1])
    expect(t.perSeries).toEqual([
      [4, 2],
      [4, 2],
    ])
    expect(t.total).toEqual([8, 4])
  })

  it('3D 1×2×12 full of 11', () => {
    const ends = Array.from({ length: 2 }, () => Array.from({ length: 12 }, () => '11'))
    const t = tiebreakTable(ends, 2, face('3d'))
    expect(t.points).toEqual([11, 10])
    expect(t.perEnd).toEqual([
      [12, 0],
      [12, 0],
    ])
    expect(t.perSeries).toEqual([[24, 0]])
    expect(t.total).toEqual([24, 0])
  })

  it('a face with fewer than two positive values gives narrower rows', () => {
    const t = tiebreakTable(
      [['A', 'M']],
      1,
      synthetic([
        ['A', 5],
        ['M', 0],
      ]),
    )
    expect(t.points).toEqual([5])
    expect(t.perEnd).toEqual([[1]])
    expect(t.total).toEqual([1])
    const none = tiebreakTable([['M']], 1, synthetic([['M', 0]]))
    expect(none).toEqual({ points: [], perEnd: [[]], perSeries: [[]], total: [] })
  })

  it('no ends → no rows and no series', () => {
    expect(tiebreakTable([], 10, face('wa-40'))).toEqual({
      points: [10, 9],
      perEnd: [],
      perSeries: [],
      total: [0, 0],
    })
  })

  it('endsPerSeries 0 is treated as 1 (no division by zero)', () => {
    const t = tiebreakTable([['X'], ['9']], 0, face('wa-40'))
    expect(t.perSeries).toEqual([
      [1, 0],
      [0, 1],
    ])
  })
})

describe('zoneDistribution', () => {
  it('WA 40 empty: every zone in catalogue order with 0', () => {
    const f = face('wa-40')
    const d = zoneDistribution(emptyEnds(20, 3), f)
    expect(d.map((z) => z.zone.key)).toEqual(f.zones.map((z) => z.key))
    expect(d.map((z) => z.zone.key)).toEqual([
      'X',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      'M',
    ])
    expect(d.every((z) => z.count === 0)).toBe(true)
  })

  it('WA 40 partial: X and 10 are separate zones; sum equals arrows shot', () => {
    const ends = emptyEnds(20, 3)
    ends[0] = ['X', '10', '9']
    ends[1] = ['X', '10', '9']
    ends[5] = ['M', null, null]
    const d = zoneDistribution(ends, face('wa-40'))
    const c = counts(d)
    expect(c).toMatchObject({ X: 2, '10': 2, '9': 2, M: 1, '8': 0, '1': 0 })
    expect(d.reduce((s, z) => s + z.count, 0)).toBe(7)
  })

  it('keeps the zone colors from the catalogue', () => {
    const f = face('wa-40')
    const d = zoneDistribution([['X']], f)
    expect(d[0]!.zone).toBe(f.zones[0])
    expect(d[0]!.zone.bg).toBe('#facc15')
  })

  it('field: X and 6 counted apart even though both are 6 points', () => {
    const c = counts(zoneDistribution([['X', '6', '6', 'M']], face('wa-field')))
    expect(c).toEqual({ X: 1, '6': 2, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0, M: 1 })
  })

  it('3D full of 11: 24 in «11», the rest 0', () => {
    const ends = Array.from({ length: 2 }, () => Array.from({ length: 12 }, () => '11'))
    const d = zoneDistribution(ends, face('3d'))
    expect(d.map((z) => [z.zone.key, z.count])).toEqual([
      ['11', 24],
      ['10', 0],
      ['8', 0],
      ['5', 0],
      ['M', 0],
    ])
  })

  it('WA 80 reducida: only its own zones (10 … 5, X, M)', () => {
    const d = zoneDistribution([['X', '5', 'M']], face('wa-80-6'))
    expect(d.map((z) => z.zone.key)).toEqual(['X', '10', '9', '8', '7', '6', '5', 'M'])
    expect(counts(d)).toMatchObject({ X: 1, '5': 1, M: 1 })
  })

  it('unknown keys are left out of every zone', () => {
    const d = zoneDistribution([['X', 'nope', '4']], face('3d'))
    expect(counts(d)).toEqual({ '11': 0, '10': 0, '8': 0, '5': 0, M: 0 })
    expect(d.reduce((s, z) => s + z.count, 0)).toBe(0)
  })
})
