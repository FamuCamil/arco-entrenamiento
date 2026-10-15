// Data model (brief: Domain > Data model). Pure types, no Vue/DOM imports.

/** One end: zone key per arrow, null = empty. */
export type End = (string | null)[]

export interface ScoringZone {
  key: string
  points: number
  /** Best-to-worst rank; matches the zone's index in TargetFace.zones. */
  order: number
  bg: string
  fg: string
}

export type TargetIcon =
  'wa-full' | 'wa-reduced' | 'wa-triple-vertical' | 'wa-triple-horizontal' | 'wa-field' | '3d'

export interface TargetFace {
  id: string
  name: string
  icon: TargetIcon
  zones: ScoringZone[]
}

export type ArcherPosition = 'A' | 'B' | 'C' | 'D'

export interface Archer {
  id: string
  name: string
  position: ArcherPosition
  /** length = seriesCount * endsPerSeries */
  ends: End[]
}

export interface Session {
  id: string
  /** YYYY-MM-DD */
  date: string
  location: string
  /** meters (0 = variable: field/3D) */
  distance: number
  faceId: string
  seriesCount: number
  endsPerSeries: number
  arrowsPerEnd: number
  archers: Archer[]
  notes: string
  /** closed = read-only */
  closed: boolean
  createdAt: number
  updatedAt: number
}

export interface PersistedState {
  version: 1
  sessions: Session[]
  profileName: string
}

/** A cell of the ends matrix: ends[row][col]. */
export interface Cell {
  row: number
  col: number
}
