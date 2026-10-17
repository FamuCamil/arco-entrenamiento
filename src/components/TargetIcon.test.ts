import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TargetIcon as Icon } from '@/domain/types'
import TargetIcon from './TargetIcon.vue'

const ICONS: Icon[] = [
  'wa-full',
  'wa-reduced',
  'wa-triple-vertical',
  'wa-triple-horizontal',
  'wa-field',
  '3d',
]

// Brief icon geometry colors.
const WHITE = '#ffffff'
const BLACK = '#000000'
const BLUE = '#00b4e4'
const RED = '#f65058'
const YELLOW = '#ffe552'
const WA_HEXES = [WHITE, BLACK, BLUE, RED, YELLOW]

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

function icon(name: Icon) {
  return mount(TargetIcon, { props: { icon: name } })
}

/** Filled rings as [data-ring, r, fill] in document order. */
function rings(w: ReturnType<typeof icon>) {
  return w
    .findAll('circle[data-ring]')
    .map((c) => [c.attributes('data-ring'), c.attributes('r'), c.attributes('fill')?.toLowerCase()])
}

function lineRadii(w: ReturnType<typeof icon>) {
  return w.findAll('circle[data-line]').map((c) => c.attributes('r'))
}

/** The outline: the first circle, stroked 1 px grey without scaling with the viewBox. */
function expectOutline(w: ReturnType<typeof icon>) {
  const outer = w.findAll('circle')[0]!
  expect(outer.attributes('stroke')?.toLowerCase()).toBe('#6b7280')
  expect(outer.attributes('stroke-width')).toBe('1')
  expect(outer.attributes('vector-effect')).toBe('non-scaling-stroke')
}

function spotCentres(w: ReturnType<typeof icon>) {
  return w.findAll('g[data-spot]').map((g) => g.attributes('transform'))
}

describe('TargetIcon', () => {
  it.each(ICONS)('%s: a decorative <svg> root tagged with its icon', (name) => {
    const w = icon(name)
    const svg = w.get('svg')
    expect(w.element).toBe(svg.element)
    expect(svg.classes()).toContain('target-icon')
    expect(svg.attributes('data-icon')).toBe(name)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(svg.attributes('width')).toBe('100%')
    expect(svg.attributes('height')).toBe('100%')
    expect(w.text()).toBe('')
  })

  it('wa-full: the five brief colors with their radii, intermediate lines and the outline', () => {
    const w = icon('wa-full')
    expect(w.get('svg').attributes('viewBox')).toBe('-70 -70 140 140')
    expect(rings(w)).toEqual([
      ['white', '60.9', WHITE],
      ['black', '48.7', BLACK],
      ['blue', '36.5', BLUE],
      ['red', '24.3', RED],
      ['yellow', '12.1', YELLOW],
    ])
    expect(lineRadii(w)).toEqual(['54.85', '42.65', '30.45', '18.25', '6.05', '3.045'])
    // The line inside the black ring is white, so it shows against it.
    expect(w.get('circle[data-line][r="42.65"]').attributes('stroke')?.toLowerCase()).toBe(WHITE)
    for (const line of w.findAll('circle[data-line]'))
      expect(line.attributes('vector-effect')).toBe('non-scaling-stroke')
    expect(w.get('g').attributes('fill')).toBe('none')
    expect(w.get('g').attributes('stroke-width')).toBe('0.5')
    expectOutline(w)
  })

  it('wa-reduced: only blue inwards, no white or black ring, at most r 36.5', () => {
    const w = icon('wa-reduced')
    expect(w.get('svg').attributes('viewBox')).toBe('-40 -40 80 80')
    expect(rings(w)).toEqual([
      ['blue', '36.5', BLUE],
      ['red', '24.3', RED],
      ['yellow', '12.1', YELLOW],
    ])
    const fills = w.findAll('circle').map((c) => c.attributes('fill')?.toLowerCase())
    expect(fills).not.toContain(WHITE)
    expect(fills).not.toContain(BLACK)
    const radii = w.findAll('circle').map((c) => Number(c.attributes('r')))
    expect(Math.max(...radii)).toBe(36.5)
    expect(lineRadii(w)).toEqual(['30.45', '18.25', '6.05', '3.045'])
    expectOutline(w)
  })

  it.each([
    ['wa-triple-vertical', ['translate(0 -22)', 'translate(0 0)', 'translate(0 22)']],
    ['wa-triple-horizontal', ['translate(-22 0)', 'translate(0 0)', 'translate(22 0)']],
  ] as const)('%s: three 9.9/7.9/3.9 spots 22 units apart', (name, centres) => {
    const w = icon(name)
    expect(w.get('svg').attributes('viewBox')).toBe('-34 -34 68 68')
    expect(spotCentres(w)).toEqual(centres)
    for (const spot of w.findAll('g[data-spot]')) {
      expect(
        spot.findAll('circle').map((c) => [c.attributes('r'), c.attributes('fill')?.toLowerCase()]),
      ).toEqual([
        ['9.9', BLUE],
        ['7.9', RED],
        ['3.9', YELLOW],
      ])
      expect(spot.get('circle').attributes('stroke')?.toLowerCase()).toBe('#6b7280')
    }
  })

  it('wa-field (simplified): black rings with a yellow centre', () => {
    const w = icon('wa-field')
    expect(w.get('svg').attributes('viewBox')).toBe('-70 -70 140 140')
    expect(rings(w)).toEqual([
      ['black', '60', BLACK],
      ['yellow', '24', YELLOW],
    ])
    expect(lineRadii(w)).toEqual(['48', '36', '12', '6'])
    expectOutline(w)
  })

  it('3d (simplified): concentric zones 5/8/10/11, none in the WA palette', () => {
    const w = icon('3d')
    expect(w.get('svg').attributes('viewBox')).toBe('-40 -40 80 80')
    const zones = w
      .findAll('circle[data-zone]')
      .map((c) => [
        c.attributes('data-zone'),
        c.attributes('r'),
        c.attributes('fill')?.toLowerCase(),
      ])
    expect(zones).toEqual([
      ['5', '36', '#4d7c0f'],
      ['8', '24', '#a16207'],
      ['10', '12', '#d97706'],
      ['11', '5', '#fef3c7'],
    ])
    for (const [, , fill] of zones) expect(WA_HEXES).not.toContain(fill)
    expect(w.findAll('circle[data-ring]')).toHaveLength(0)
    expectOutline(w)
  })

  it('draws a different SVG for every icon', () => {
    const markup = ICONS.map((name) => icon(name).html())
    expect(new Set(markup).size).toBe(ICONS.length)
  })
})
