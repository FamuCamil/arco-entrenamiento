import type { Cell, End, TargetFace } from './types'

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
