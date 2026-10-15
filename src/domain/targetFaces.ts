import type { ScoringZone, TargetFace, TargetIcon } from './types'

// Target-face catalog (brief: Domain > Target-face catalog).
// Zones are listed best-to-worst; `order` equals the array index.
//
// Keypad colors per brief: X/10/9 yellow, 8/7 red, 6/5 blue, 4/3 black, 2/1 white, M grey.
// Decisions recorded by UC01 (plan R1):
// - Field face: brief says "6/5 yellow, everything else black". X is yellow too (it is the
//   inner 6 ring) and M is grey, consistent with every other face.
// - 3D (colors delegated to this use case): 11/10 yellow, 8 red, 5 blue, M grey.

const YELLOW = '#facc15'
const RED = '#ef4444'
const BLUE = '#3b82f6'
const BLACK = '#111827'
const WHITE = '#ffffff'
const GREY = '#d1d5db'

const DARK_TEXT = '#111827'
const LIGHT_TEXT = '#ffffff'

const FG_FOR: Record<string, string> = {
  [YELLOW]: DARK_TEXT,
  [RED]: LIGHT_TEXT,
  [BLUE]: LIGHT_TEXT,
  [BLACK]: LIGHT_TEXT,
  [WHITE]: DARK_TEXT,
  [GREY]: DARK_TEXT,
}

/** Standard WA ring color for a numeric score 1..10. */
function waRingColor(points: number): string {
  if (points >= 9) return YELLOW
  if (points >= 7) return RED
  if (points >= 5) return BLUE
  if (points >= 3) return BLACK
  return WHITE
}

/** Builds zones in the given best-to-worst sequence, assigning `order` from the index. */
function zones(spec: [key: string, points: number, bg: string][]): ScoringZone[] {
  return spec.map(([key, points, bg], order) => ({
    key,
    points,
    order,
    bg,
    fg: FG_FOR[bg] ?? DARK_TEXT,
  }))
}

/** WA face: X (10 points), then lowest..10 descending, then M. */
function waZones(lowest: number): ScoringZone[] {
  const spec: [string, number, string][] = [['X', 10, YELLOW]]
  for (let p = 10; p >= lowest; p--) spec.push([String(p), p, waRingColor(p)])
  spec.push(['M', 0, GREY])
  return zones(spec)
}

function face(id: string, name: string, icon: TargetIcon, faceZones: ScoringZone[]): TargetFace {
  return { id, name, icon, zones: faceZones }
}

export const TARGET_FACES: readonly TargetFace[] = [
  face('wa-122', 'WA 122 cm', 'wa-full', waZones(1)),
  face('wa-80', 'WA 80 cm', 'wa-full', waZones(1)),
  face('wa-80-6', 'WA 80 cm reducida (6 anillos)', 'wa-reduced', waZones(5)),
  face('wa-60', 'WA 60 cm', 'wa-full', waZones(1)),
  face('wa-40', 'WA 40 cm', 'wa-full', waZones(1)),
  face('wa-40-triple', 'WA 40 cm triple', 'wa-triple-vertical', waZones(6)),
  face(
    'wa-field',
    'WA Campo',
    'wa-field',
    zones([
      ['X', 6, YELLOW],
      ['6', 6, YELLOW],
      ['5', 5, YELLOW],
      ['4', 4, BLACK],
      ['3', 3, BLACK],
      ['2', 2, BLACK],
      ['1', 1, BLACK],
      ['M', 0, GREY],
    ]),
  ),
  face(
    '3d',
    '3D',
    '3d',
    zones([
      ['11', 11, YELLOW],
      ['10', 10, YELLOW],
      ['8', 8, RED],
      ['5', 5, BLUE],
      ['M', 0, GREY],
    ]),
  ),
]

export function getTargetFace(id: string): TargetFace | undefined {
  return TARGET_FACES.find((f) => f.id === id)
}
