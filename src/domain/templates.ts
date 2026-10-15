// Session templates (brief: Domain > Templates).

export interface SessionPreset {
  /** meters (0 = variable: field/3D) */
  distance: number
  faceId: string
  seriesCount: number
  endsPerSeries: number
  arrowsPerEnd: number
}

export interface SessionTemplate {
  id: string
  /** UI label (Spanish) */
  label: string
  /** null = custom template: every value is chosen freely by the user. */
  preset: SessionPreset | null
}

function preset(
  distance: number,
  faceId: string,
  seriesCount: number,
  endsPerSeries: number,
  arrowsPerEnd: number,
): SessionPreset {
  return { distance, faceId, seriesCount, endsPerSeries, arrowsPerEnd }
}

export const SESSION_TEMPLATES: readonly SessionTemplate[] = [
  { id: 'sala-18', label: 'Sala 18 m', preset: preset(18, 'wa-40', 2, 10, 3) },
  { id: 'sala-18-triple', label: 'Sala 18 m triple', preset: preset(18, 'wa-40-triple', 2, 10, 3) },
  { id: 'sala-25', label: 'Sala 25 m', preset: preset(25, 'wa-60', 2, 10, 3) },
  { id: 'aire-libre-70', label: 'Aire libre 70 m', preset: preset(70, 'wa-122', 2, 6, 6) },
  {
    id: 'aire-libre-50-compuesto',
    label: 'Aire libre 50 m compuesto',
    preset: preset(50, 'wa-80-6', 2, 6, 6),
  },
  { id: 'aire-libre-30', label: 'Aire libre 30 m', preset: preset(30, 'wa-80', 2, 6, 6) },
  { id: 'campo', label: 'Campo', preset: preset(0, 'wa-field', 2, 12, 3) },
  { id: '3d', label: '3D', preset: preset(0, '3d', 2, 12, 2) },
  { id: 'personalizada', label: 'Personalizada', preset: null },
]

export function getTemplate(id: string): SessionTemplate | undefined {
  return SESSION_TEMPLATES.find((t) => t.id === id)
}
