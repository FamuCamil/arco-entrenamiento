// New-session form (CU-01/CU-02): initial values, template application and validation.
// Pure, no Vue imports. The view keeps the raw values and renders the errors.

import type { SessionInput } from '@/stores/sessions'

import { getTargetFace } from './targetFaces'
import { getTemplate, type SessionTemplate } from './templates'

export const DEFAULT_TEMPLATE_ID = 'sala-18'
export const CUSTOM_TEMPLATE_ID = 'personalizada'

/**
 * Form limits. The spec only asks for ≥ 1 series and ends; the upper caps stop a typo such as
 * 100 × 100 from creating an unmanageable grid. Templates use at most 2 × 12, and 20 × 30 × 12 =
 * 7200 cells is the largest grid accepted. Distance has no upper bound (integer ≥ 0, 0 = variable).
 * These caps apply to the form only: stored and legacy sessions are not checked against them.
 */
export const SESSION_LIMITS = {
  seriesCount: { min: 1, max: 20 },
  endsPerSeries: { min: 1, max: 30 },
  arrowsPerEnd: { min: 1, max: 12 },
} as const

/** Numeric fields are raw strings as typed, so an empty input stays distinct from 0. */
export interface SessionFormValues {
  date: string
  location: string
  /** Distance is «Variable» (stored as 0); `distance` is then ignored. */
  variableDistance: boolean
  distance: string
  faceId: string
  seriesCount: string
  endsPerSeries: string
  arrowsPerEnd: string
  notes: string
}

export type SessionFormField =
  'date' | 'distance' | 'faceId' | 'seriesCount' | 'endsPerSeries' | 'arrowsPerEnd'

export type SessionFormErrors = Partial<Record<SessionFormField, string>>

export interface SessionFormValidation {
  errors: SessionFormErrors
  /** Non-null only when `errors` is empty. */
  input: SessionInput | null
}

const EMPTY_VALUES: SessionFormValues = {
  date: '',
  location: '',
  variableDistance: false,
  distance: '',
  faceId: '',
  seriesCount: '',
  endsPerSeries: '',
  arrowsPerEnd: '',
  notes: '',
}

/** The Sala 18 m preset on an empty form, dated `today` (the view passes localIsoDate()). */
export function initialFormValues(today: string): SessionFormValues {
  const template = getTemplate(DEFAULT_TEMPLATE_ID)
  const values = template ? applyTemplate(EMPTY_VALUES, template) : EMPTY_VALUES
  return { ...values, date: today }
}

/**
 * A preset overwrites distance, face and structure, keeping date, location and notes.
 * A template without preset («Personalizada») returns the values unchanged (as a copy).
 */
export function applyTemplate(
  values: SessionFormValues,
  template: SessionTemplate,
): SessionFormValues {
  const { preset } = template
  if (!preset) return { ...values }
  return {
    ...values,
    variableDistance: preset.distance === 0,
    distance: preset.distance === 0 ? '' : String(preset.distance),
    faceId: preset.faceId,
    seriesCount: String(preset.seriesCount),
    endsPerSeries: String(preset.endsPerSeries),
    arrowsPerEnd: String(preset.arrowsPerEnd),
  }
}

const DIGITS = /^\d+$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Whole number from all-digit text ('03' → 3); null for '', '1.5', '-1', 'abc'. */
function parseWhole(text: string): number | null {
  const trimmed = text.trim()
  return DIGITS.test(trimmed) ? Number(trimmed) : null
}

/** YYYY-MM-DD that is a real calendar day (checked in UTC, so no time-zone shift). */
function isValidIsoDate(text: string): boolean {
  const match = ISO_DATE.exec(text)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function inRange(value: number | null, limit: { min: number; max: number }): value is number {
  return value !== null && value >= limit.min && value <= limit.max
}

const MESSAGES = {
  date: 'Fecha no válida',
  distance: 'Indica los metros o marca «Variable»',
  faceId: 'Elige una diana del catálogo',
  seriesCount: `Entre ${SESSION_LIMITS.seriesCount.min} y ${SESSION_LIMITS.seriesCount.max} series`,
  endsPerSeries: `Entre ${SESSION_LIMITS.endsPerSeries.min} y ${SESSION_LIMITS.endsPerSeries.max} tandas por serie`,
  arrowsPerEnd: `Entre ${SESSION_LIMITS.arrowsPerEnd.min} y ${SESSION_LIMITS.arrowsPerEnd.max} flechas`,
} as const satisfies Record<SessionFormField, string>

export function validateSessionForm(values: SessionFormValues): SessionFormValidation {
  const errors: SessionFormErrors = {}

  if (!isValidIsoDate(values.date)) errors.date = MESSAGES.date

  const distance = values.variableDistance ? 0 : parseWhole(values.distance)
  if (distance === null) errors.distance = MESSAGES.distance

  if (!getTargetFace(values.faceId)) errors.faceId = MESSAGES.faceId

  const seriesCount = parseWhole(values.seriesCount)
  if (!inRange(seriesCount, SESSION_LIMITS.seriesCount)) errors.seriesCount = MESSAGES.seriesCount

  const endsPerSeries = parseWhole(values.endsPerSeries)
  if (!inRange(endsPerSeries, SESSION_LIMITS.endsPerSeries)) {
    errors.endsPerSeries = MESSAGES.endsPerSeries
  }

  const arrowsPerEnd = parseWhole(values.arrowsPerEnd)
  if (!inRange(arrowsPerEnd, SESSION_LIMITS.arrowsPerEnd))
    errors.arrowsPerEnd = MESSAGES.arrowsPerEnd

  if (Object.keys(errors).length > 0) return { errors, input: null }

  return {
    errors,
    input: {
      date: values.date,
      location: values.location.trim(),
      distance: distance!,
      faceId: values.faceId,
      seriesCount: seriesCount!,
      endsPerSeries: endsPerSeries!,
      arrowsPerEnd: arrowsPerEnd!,
      notes: values.notes.trim(),
    },
  }
}
