import type { Archer, Cell, End, TargetFace } from './types'

// Scoring rules (brief: Domain > Scoring rules). Pure functions.

/** The zone's points; 0 for null or an unknown key. */
export function zonePoints(key: string | null, face: TargetFace): number {
  if (key === null) return 0
  return face.zones.find((z) => z.key === key)?.points ?? 0
}

/** First empty cell in row-major order; the last cell if none; {0,0} for an empty matrix. */
export function firstEmptyCell(ends: End[]): Cell {
  for (let row = 0; row < ends.length; row++) {
    const col = ends[row]!.indexOf(null)
    if (col !== -1) return { row, col }
  }
  const lastRow = ends.length - 1
  if (lastRow < 0) return { row: 0, col: 0 }
  return { row: lastRow, col: Math.max(0, ends[lastRow]!.length - 1) }
}

/**
 * Next arrow; from the last arrow of a row, the first arrow of the next row; at the last cell
 * of the session it stays put. Differs from the brief's `nextCell(cell)`: the matrix
 * dimensions are taken from `ends`.
 */
export function nextCell(cell: Cell, ends: End[]): Cell {
  const rowLength = ends[cell.row]?.length ?? 0
  if (cell.col + 1 < rowLength) return { row: cell.row, col: cell.col + 1 }
  if (cell.row + 1 < ends.length) return { row: cell.row + 1, col: 0 }
  return { row: cell.row, col: cell.col }
}

/**
 * Best-to-worst by zone order; empties last. Pure, stable. Keys not on the face (e.g. hydrated
 * data) go after the known keys and before the empties.
 */
export function sortEnd(end: End, face: TargetFace): End {
  const orderByKey = new Map(face.zones.map((z) => [z.key, z.order]))
  const rank = (key: string | null): number => {
    if (key === null) return Number.POSITIVE_INFINITY
    return orderByKey.get(key) ?? Number.MAX_SAFE_INTEGER
  }
  return [...end].sort((a, b) => rank(a) - rank(b))
}

/** Highest zone points on the face (10 on WA 40, 6 on field, 11 on 3D); 0 with no zones. */
export function maxArrowPoints(face: TargetFace): number {
  return face.zones.reduce((max, z) => Math.max(max, z.points), 0)
}

/** Sum of the end's zone points; empties count 0. */
export function endTotal(end: End, face: TargetFace): number {
  return end.reduce((sum, key) => sum + zonePoints(key, face), 0)
}

/**
 * Series running total: from the first end of the row's series (floor(row / endsPerSeries))
 * up to the row, inclusive. 0 for a row out of range.
 */
export function seriesRunningTotal(
  ends: End[],
  row: number,
  endsPerSeries: number,
  face: TargetFace,
): number {
  if (!Number.isInteger(row) || row < 0 || row >= ends.length || endsPerSeries < 1) return 0
  const first = Math.floor(row / endsPerSeries) * endsPerSeries
  let sum = 0
  for (let r = first; r <= row; r++) sum += endTotal(ends[r]!, face)
  return sum
}

/** Total of series `series` (0-based); 0 for a series out of range. */
export function seriesTotal(
  ends: End[],
  series: number,
  endsPerSeries: number,
  face: TargetFace,
): number {
  if (!Number.isInteger(series) || series < 0 || endsPerSeries < 1) return 0
  return ends
    .slice(series * endsPerSeries, (series + 1) * endsPerSeries)
    .reduce((sum, end) => sum + endTotal(end, face), 0)
}

/** Total of every end of the session. */
export function grandTotal(ends: End[], face: TargetFace): number {
  return ends.reduce((sum, end) => sum + endTotal(end, face), 0)
}

/**
 * Average points per arrow shot (non-empty cells), rounded to 2 decimals; null when no arrow
 * was shot.
 */
export function averagePerArrow(ends: End[], face: TargetFace): number | null {
  const shot = ends.reduce((n, end) => n + end.filter((key) => key !== null).length, 0)
  if (shot === 0) return null
  return Math.round((grandTotal(ends, face) * 100) / shot) / 100
}

/** True when any archer has at least one non-empty cell, whatever its key (CU-11 lock). */
export function hasAnyArrow(archers: readonly Archer[]): boolean {
  return archers.some((archer) => archer.ends.some((end) => end.some((key) => key !== null)))
}
