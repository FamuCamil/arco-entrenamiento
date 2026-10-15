import { describe, expect, it } from 'vitest'

import { TARGET_FACES, getTargetFace } from './targetFaces'

const YELLOW = '#facc15'
const RED = '#ef4444'
const BLUE = '#3b82f6'
const BLACK = '#111827'
const WHITE = '#ffffff'
const GREY = '#d1d5db'
const DARK_TEXT = '#111827'
const LIGHT_TEXT = '#ffffff'

function keys(id: string): string[] {
  return getTargetFace(id)!.zones.map((z) => z.key)
}

function colors(id: string): Record<string, string> {
  return Object.fromEntries(getTargetFace(id)!.zones.map((z) => [z.key, z.bg]))
}

describe('TARGET_FACES', () => {
  it('contains the 8 brief faces', () => {
    expect(TARGET_FACES.map((f) => f.id)).toEqual([
      'wa-122',
      'wa-80',
      'wa-80-6',
      'wa-60',
      'wa-40',
      'wa-40-triple',
      'wa-field',
      '3d',
    ])
  })

  it('has unique ids and non-empty names', () => {
    expect(new Set(TARGET_FACES.map((f) => f.id)).size).toBe(TARGET_FACES.length)
    for (const f of TARGET_FACES) expect(f.name.length).toBeGreaterThan(0)
  })

  it.each(TARGET_FACES.map((f) => [f.id, f] as const))(
    '%s: every zone has key, points, order, bg and fg; order equals the index',
    (_, f) => {
      expect(f.zones.length).toBeGreaterThan(0)
      f.zones.forEach((z, i) => {
        expect(typeof z.key).toBe('string')
        expect(z.key.length).toBeGreaterThan(0)
        expect(Number.isInteger(z.points)).toBe(true)
        expect(z.order).toBe(i)
        expect(z.bg).toMatch(/^#[0-9a-f]{6}$/)
        expect(z.fg).toMatch(/^#[0-9a-f]{6}$/)
      })
      expect(new Set(f.zones.map((z) => z.key)).size).toBe(f.zones.length)
    },
  )

  it.each(TARGET_FACES.map((f) => [f.id, f] as const))(
    '%s: zones are listed best-to-worst (points never increase) and end with M = 0',
    (_, f) => {
      for (let i = 1; i < f.zones.length; i++) {
        expect(f.zones[i]!.points).toBeLessThanOrEqual(f.zones[i - 1]!.points)
      }
      const last = f.zones[f.zones.length - 1]!
      expect(last).toMatchObject({ key: 'M', points: 0, bg: GREY })
    },
  )

  it.each(TARGET_FACES.map((f) => [f.id, f] as const))(
    '%s: text color is dark on light backgrounds and white on dark ones',
    (_, f) => {
      for (const z of f.zones) {
        const expected = [YELLOW, WHITE, GREY].includes(z.bg) ? DARK_TEXT : LIGHT_TEXT
        expect(z.fg).toBe(expected)
      }
    },
  )

  it('WA 40 keys are X, 10..1, M with WA ring colors', () => {
    expect(keys('wa-40')).toEqual(['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'])
    expect(colors('wa-40')).toEqual({
      X: YELLOW,
      '10': YELLOW,
      '9': YELLOW,
      '8': RED,
      '7': RED,
      '6': BLUE,
      '5': BLUE,
      '4': BLACK,
      '3': BLACK,
      '2': WHITE,
      '1': WHITE,
      M: GREY,
    })
    expect(getTargetFace('wa-40')!.zones[0]!.points).toBe(10)
  })

  it.each(['wa-122', 'wa-80', 'wa-60'])('%s has the full 12-zone layout', (id) => {
    expect(keys(id)).toEqual(keys('wa-40'))
  })

  it('reduced faces stop at their lowest ring', () => {
    expect(keys('wa-80-6')).toEqual(['X', '10', '9', '8', '7', '6', '5', 'M'])
    expect(keys('wa-40-triple')).toEqual(['X', '10', '9', '8', '7', '6', 'M'])
  })

  it('field face: X/6/5 yellow, 4..1 black, M grey; X scores 6', () => {
    expect(keys('wa-field')).toEqual(['X', '6', '5', '4', '3', '2', '1', 'M'])
    expect(colors('wa-field')).toEqual({
      X: YELLOW,
      '6': YELLOW,
      '5': YELLOW,
      '4': BLACK,
      '3': BLACK,
      '2': BLACK,
      '1': BLACK,
      M: GREY,
    })
    expect(getTargetFace('wa-field')!.zones[0]!.points).toBe(6)
  })

  it('3D face: 11/10 yellow, 8 red, 5 blue, M grey', () => {
    const f = getTargetFace('3d')!
    expect(f.zones.map((z) => [z.key, z.points, z.bg])).toEqual([
      ['11', 11, YELLOW],
      ['10', 10, YELLOW],
      ['8', 8, RED],
      ['5', 5, BLUE],
      ['M', 0, GREY],
    ])
  })
})

describe('getTargetFace', () => {
  it('finds a face by id', () => {
    expect(getTargetFace('wa-40')?.name).toBe('WA 40 cm')
  })

  it('returns undefined for an unknown id', () => {
    expect(getTargetFace('nope')).toBeUndefined()
  })
})
