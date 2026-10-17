import { describe, expect, it } from 'vitest'

import { getTargetFace } from './targetFaces'
import { SESSION_TEMPLATES, getTemplate } from './templates'

describe('SESSION_TEMPLATES', () => {
  it('contains the 9 brief templates with their values', () => {
    expect(
      SESSION_TEMPLATES.map((t) => [
        t.label,
        t.preset &&
          [
            t.preset.distance,
            t.preset.faceId,
            t.preset.seriesCount,
            t.preset.endsPerSeries,
            t.preset.arrowsPerEnd,
          ].join(' '),
      ]),
    ).toEqual([
      ['Sala 18 m', '18 wa-40 2 10 3'],
      ['Sala 18 m triple', '18 wa-40-triple 2 10 3'],
      ['Sala 25 m', '25 wa-60 2 10 3'],
      ['Aire libre 70 m', '70 wa-122 2 6 6'],
      ['Aire libre 50 m compuesto', '50 wa-80-6 2 6 6'],
      ['Aire libre 30 m', '30 wa-80 2 6 6'],
      ['Campo', '0 wa-field 2 12 3'],
      ['3D', '0 3d 2 12 2'],
      ['Personalizada', null],
    ])
  })

  it('has unique kebab-case ids', () => {
    const ids = SESSION_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every preset faceId resolves to a catalog face', () => {
    for (const t of SESSION_TEMPLATES) {
      if (t.preset) expect(getTargetFace(t.preset.faceId), t.id).toBeDefined()
    }
  })

  it('only Personalizada has no preset', () => {
    expect(SESSION_TEMPLATES.filter((t) => t.preset === null).map((t) => t.label)).toEqual([
      'Personalizada',
    ])
  })
})

describe('getTemplate', () => {
  it('returns a template by id (Sala 18 m: WA 40, 2x10x3)', () => {
    expect(getTemplate('sala-18')).toEqual({
      id: 'sala-18',
      label: 'Sala 18 m',
      preset: { distance: 18, faceId: 'wa-40', seriesCount: 2, endsPerSeries: 10, arrowsPerEnd: 3 },
    })
  })

  it('returns undefined for an unknown id', () => {
    expect(getTemplate('nope')).toBeUndefined()
  })
})
