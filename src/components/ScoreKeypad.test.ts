import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { TARGET_FACES, getTargetFace } from '@/domain/targetFaces'
import type { TargetFace } from '@/domain/types'
import ScoreKeypad from './ScoreKeypad.vue'

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function keypad(face: TargetFace, disabled?: boolean) {
  return mount(ScoreKeypad, { props: { face, disabled } })
}

describe('ScoreKeypad', () => {
  it('is a labelled group', () => {
    const group = keypad(getTargetFace('wa-40')!).get('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Teclado de puntuación')
  })

  it.each(TARGET_FACES.map((f) => [f.id, f] as const))(
    '%s: exactly one key per zone, in catalog order',
    (_, face) => {
      const keys = keypad(face).findAll('button')
      expect(keys.map((k) => k.text())).toEqual(face.zones.map((z) => z.key))
      expect(keys.map((k) => k.attributes('data-testid'))).toEqual(
        face.zones.map((z) => `key-${z.key}`),
      )
    },
  )

  it('WA 40 shows X, 10 … 1, M', () => {
    const keys = keypad(getTargetFace('wa-40')!).findAll('button')
    expect(keys.map((k) => k.text())).toEqual([
      'X',
      '10',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      'M',
    ])
  })

  it.each(TARGET_FACES.map((f) => [f.id, f] as const))(
    '%s: key colors come from zone bg/fg',
    (_, face) => {
      const keys = keypad(face).findAll('button')
      face.zones.forEach((z, i) => {
        const style = (keys[i]!.element as HTMLElement).style
        expect(style.backgroundColor).toBe(rgb(z.bg))
        expect(style.color).toBe(rgb(z.fg))
      })
    },
  )

  it('colors follow the zone data, not the key text', () => {
    // Same key text with deliberately swapped colors: the key must use the data.
    const face: TargetFace = {
      id: 'fake',
      name: 'Fake',
      icon: 'wa-full',
      zones: [
        { key: 'X', points: 10, order: 0, bg: '#3b82f6', fg: '#ffffff' },
        { key: '10', points: 10, order: 1, bg: '#111827', fg: '#ffffff' },
        { key: 'M', points: 0, order: 2, bg: '#ef4444', fg: '#ffffff' },
      ],
    }
    const keys = keypad(face).findAll('button')
    expect((keys[0]!.element as HTMLElement).style.backgroundColor).toBe(rgb('#3b82f6'))
    expect((keys[1]!.element as HTMLElement).style.backgroundColor).toBe(rgb('#111827'))
    expect((keys[2]!.element as HTMLElement).style.backgroundColor).toBe(rgb('#ef4444'))
  })

  it('every key has a Spanish aria-label; M is «Anotar fallo»', () => {
    const keys = keypad(getTargetFace('wa-40')!).findAll('button')
    expect(keys.map((k) => k.attributes('aria-label'))).toEqual([
      'Anotar X',
      'Anotar 10',
      'Anotar 9',
      'Anotar 8',
      'Anotar 7',
      'Anotar 6',
      'Anotar 5',
      'Anotar 4',
      'Anotar 3',
      'Anotar 2',
      'Anotar 1',
      'Anotar fallo',
    ])
  })

  it('keys are type=button', () => {
    for (const k of keypad(getTargetFace('3d')!).findAll('button')) {
      expect(k.attributes('type')).toBe('button')
    }
  })

  it('emits score with the zone key on click', async () => {
    const w = keypad(getTargetFace('wa-40')!)
    await w.get('[data-testid="key-X"]').trigger('click')
    await w.get('[data-testid="key-M"]').trigger('click')
    expect(w.emitted('score')).toEqual([['X'], ['M']])
  })

  it('disables every key and emits nothing when disabled', async () => {
    const w = keypad(getTargetFace('wa-40')!, true)
    for (const k of w.findAll('button')) expect(k.attributes('disabled')).toBeDefined()
    await w.get('[data-testid="key-X"]').trigger('click')
    expect(w.emitted('score')).toBeUndefined()
  })
})
