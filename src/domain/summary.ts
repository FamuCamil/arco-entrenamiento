import { zonePoints } from './scoring'
import type { End, ScoringZone, TargetFace } from './types'

// Session summary (CU-08): tiebreak counts and zone distribution. Pure functions; everything
// comes from the zones' `points`, never from parsing the key (field X = 6, 3D has an 11).

export interface TiebreakTable {
  /** Column values, best first (e.g. [10, 9] on WA). */
  points: number[]
  /** Per row: one count per column. */
  perEnd: number[][]
  /** Per series: one count per column. */
  perSeries: number[][]
  /** Whole session: one count per column. */
  total: number[]
}

/**
 * The two best distinct positive point values of the face, descending: [10, 9] on WA, [6, 5] on
 * field, [11, 10] on 3D. Fewer than two when the face has fewer (M, 0 points, is never one).
 */
export function tiebreakPoints(face: TargetFace): number[] {
  const distinct = new Set(face.zones.map((z) => z.points).filter((p) => p > 0))
  return [...distinct].sort((a, b) => b - a).slice(0, 2)
}

/**
 * One count per value of `points`: arrows whose zone scores exactly that value, so X = 10 counts
 * in «10» and 3D zones sharing points share a column. Empty and unknown keys score 0 and never
 * count.
 */
export function tiebreakCounts(ends: End[], face: TargetFace, points: number[]): number[] {
  const counts = points.map(() => 0)
  for (const end of ends) {
    for (const key of end) {
      const index = points.indexOf(zonePoints(key, face))
      if (key !== null && index !== -1) counts[index]!++
    }
  }
  return counts
}

/** Tiebreak counts per end, per series (rows grouped by floor(row / endsPerSeries)) and in total. */
export function tiebreakTable(ends: End[], endsPerSeries: number, face: TargetFace): TiebreakTable {
  const points = tiebreakPoints(face)
  const size = Math.max(1, endsPerSeries)
  const seriesCount = Math.ceil(ends.length / size)
  return {
    points,
    perEnd: ends.map((end) => tiebreakCounts([end], face, points)),
    perSeries: Array.from({ length: seriesCount }, (_, s) =>
      tiebreakCounts(ends.slice(s * size, (s + 1) * size), face, points),
    ),
    total: tiebreakCounts(ends, face, points),
  }
}

/**
 * Arrows per zone in catalogue order (X, 10, 9 … M), zones with 0 arrows included, counted by
 * exact key. Unknown keys (possible in hydrated data) are left out, so the sum equals the arrows
 * shot with catalogue keys.
 */
export function zoneDistribution(
  ends: End[],
  face: TargetFace,
): { zone: ScoringZone; count: number }[] {
  const counts = new Map(face.zones.map((z) => [z.key, 0]))
  for (const end of ends) {
    for (const key of end) {
      if (key !== null && counts.has(key)) counts.set(key, counts.get(key)! + 1)
    }
  }
  return face.zones.map((zone) => ({ zone, count: counts.get(zone.key)! }))
}
