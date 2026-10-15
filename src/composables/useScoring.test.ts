import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { End } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import { STORAGE_KEY } from './usePersistence'
import { useScoring } from './useScoring'

/** Seeds a 1 series × 3 ends × 3 arrows WA 40 session (s1 / a1). */
function seed(ends?: End[], overrides = {}) {
  const session = makeSession({ seriesCount: 1, endsPerSeries: 3, arrowsPerEnd: 3, ...overrides })
  if (ends) session.archers[0]!.ends = ends
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
}

const empty = (): End[] => [
  [null, null, null],
  [null, null, null],
  [null, null, null],
]

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('lookup', () => {
  it('exposes session, archer and face', () => {
    seed()
    const s = useScoring('s1', 'a1')
    expect(s.session.value?.id).toBe('s1')
    expect(s.archer.value?.id).toBe('a1')
    expect(s.face.value?.id).toBe('wa-40')
    expect(s.isLocked.value).toBe(false)
  })

  it('tolerates an unknown session', () => {
    seed()
    const s = useScoring('nope', 'a1')
    expect(s.session.value).toBeUndefined()
    expect(s.archer.value).toBeUndefined()
    expect(s.face.value).toBeUndefined()
    expect(s.selected.value).toEqual({ row: 0, col: 0 })
    expect(s.isLocked.value).toBe(false)
    expect(() => s.score('X')).not.toThrow()
  })

  it('tolerates an unknown archer without writing', () => {
    seed()
    const s = useScoring('s1', 'nope')
    expect(s.session.value?.id).toBe('s1')
    expect(s.archer.value).toBeUndefined()
    s.score('X')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[0]).toEqual([null, null, null])
    expect(s.selected.value).toEqual({ row: 0, col: 0 })
  })

  it('face is undefined when the session face is unknown', () => {
    seed(undefined, { faceId: 'missing' })
    expect(useScoring('s1', 'a1').face.value).toBeUndefined()
  })
})

describe('initial selection', () => {
  it('starts on the first cell of an empty session', () => {
    seed()
    expect(useScoring('s1', 'a1').selected.value).toEqual({ row: 0, col: 0 })
  })

  it('starts on the first empty cell', () => {
    seed([
      ['X', '9', '8'],
      ['7', null, null],
      [null, null, null],
    ])
    expect(useScoring('s1', 'a1').selected.value).toEqual({ row: 1, col: 1 })
  })

  it('starts on the last cell when the session is full', () => {
    seed([
      ['X', '9', '8'],
      ['7', '6', '5'],
      ['4', '3', 'M'],
    ])
    expect(useScoring('s1', 'a1').selected.value).toEqual({ row: 2, col: 2 })
  })
})

describe('score', () => {
  it('writes the key, advances within the end and wraps to the next end', () => {
    seed()
    const s = useScoring('s1', 'a1')
    s.score('X')
    expect(s.selected.value).toEqual({ row: 0, col: 1 })
    s.score('9')
    expect(s.selected.value).toEqual({ row: 0, col: 2 })
    s.score('M')
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    expect(s.archer.value!.ends[0]).toEqual(['X', '9', 'M'])
  })

  it('stays on the last cell and overwrites it on the next press', () => {
    seed([
      ['X', '9', '8'],
      ['7', '6', '5'],
      ['4', '3', null],
    ])
    const s = useScoring('s1', 'a1')
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
    s.score('2')
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
    expect(s.archer.value!.ends[2]![2]).toBe('2')
    s.score('1')
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
    expect(s.archer.value!.ends[2]![2]).toBe('1')
  })

  it('persists each arrow immediately', async () => {
    seed()
    const s = useScoring('s1', 'a1')
    s.score('10')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sessions[0].archers[0].ends[0]).toEqual(['10', null, null])
  })

  it('does not write or move when the session is closed', () => {
    seed(undefined, { closed: true })
    const s = useScoring('s1', 'a1')
    expect(s.isLocked.value).toBe(true)
    s.score('X')
    expect(s.archer.value!.ends[0]).toEqual([null, null, null])
    expect(s.selected.value).toEqual({ row: 0, col: 0 })
  })

  it('reacts when the session becomes closed', () => {
    seed()
    const s = useScoring('s1', 'a1')
    useSessionsStore().getSession('s1')!.closed = true
    expect(s.isLocked.value).toBe(true)
    s.score('X')
    expect(s.archer.value!.ends[0]).toEqual([null, null, null])
  })

  it('selection resumes at the first empty cell for a fresh composable (reload)', () => {
    seed(empty())
    const first = useScoring('s1', 'a1')
    first.score('X')
    first.score('X')
    first.score('X')
    first.score('9')
    const reloaded = useScoring('s1', 'a1')
    expect(reloaded.selected.value).toEqual({ row: 1, col: 1 })
  })
})

describe('select', () => {
  const partial = (): End[] => [
    ['X', '9', '8'],
    [null, null, null],
    [null, null, null],
  ]

  it('selects any cell: filled, empty, or empty but not the first empty', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    s.select(0, 1)
    expect(s.selected.value).toEqual({ row: 0, col: 1 })
    s.select(1, 0)
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    s.select(2, 2)
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
  })

  it('does not write anything by itself', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(0, 0)
    expect(s.archer.value!.ends).toEqual(partial())
  })

  it('select then score overwrites a filled cell and advances to the next arrow', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(0, 1)
    s.score('7')
    expect(s.archer.value!.ends[0]).toEqual(['X', '7', '8'])
    expect(s.selected.value).toEqual({ row: 0, col: 2 })
  })

  it('a correction does not re-sort the end (sorting arrives with CU-06)', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(0, 0)
    s.score('1')
    expect(s.archer.value!.ends[0]).toEqual(['1', '9', '8'])
  })

  it('writing the last arrow of an end wraps to the first arrow of the next end', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(0, 2)
    s.score('M')
    expect(s.archer.value!.ends[0]).toEqual(['X', '9', 'M'])
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
  })

  it('writing the last cell of the session keeps the selection there', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(2, 2)
    s.score('5')
    expect(s.archer.value!.ends[2]).toEqual([null, null, '5'])
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
  })

  it('out-of-order writing leaves earlier gaps empty', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(2, 0)
    s.score('10')
    s.score('9')
    expect(s.archer.value!.ends).toEqual([
      ['X', '9', '8'],
      [null, null, null],
      ['10', '9', null],
    ])
    expect(s.selected.value).toEqual({ row: 2, col: 2 })
  })

  it('a fresh composable (reload) selects the first gap, not the last written cell', () => {
    seed(partial())
    const first = useScoring('s1', 'a1')
    first.select(2, 0)
    first.score('10')
    expect(useScoring('s1', 'a1').selected.value).toEqual({ row: 1, col: 0 })
  })

  it('persists the correction immediately', async () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    await nextTick()
    s.select(0, 1)
    s.score('6')
    await nextTick()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', '6', '8'])
  })

  it('is a no-op when the session is closed', () => {
    seed(partial(), { closed: true })
    const s = useScoring('s1', 'a1')
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    s.select(0, 1)
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    s.score('1')
    expect(s.archer.value!.ends).toEqual(partial())
  })

  it('is a no-op once the session becomes closed', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(0, 1)
    useSessionsStore().getSession('s1')!.closed = true
    s.select(2, 2)
    expect(s.selected.value).toEqual({ row: 0, col: 1 })
  })

  it('is a no-op for an unknown archer or session', () => {
    seed()
    const a = useScoring('s1', 'nope')
    a.select(1, 1)
    expect(a.selected.value).toEqual({ row: 0, col: 0 })
    const b = useScoring('nope', 'a1')
    b.select(1, 1)
    expect(b.selected.value).toEqual({ row: 0, col: 0 })
  })

  it.each([
    ['a negative row', -1, 0],
    ['a row past the end', 3, 0],
    ['a fractional row', 0.5, 0],
    ['a NaN row', Number.NaN, 0],
    ['a negative arrow', 1, -1],
    ['an arrow past the end of the row', 1, 3],
    ['a fractional arrow', 1, 1.5],
    ['an infinite arrow', 1, Number.POSITIVE_INFINITY],
  ])('is a no-op for %s', (_, row, col) => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    s.select(row, col)
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
  })

  it('checks the arrow against the length of the selected row', () => {
    seed(partial())
    const s = useScoring('s1', 'a1')
    // Hydration rejects ragged ends, so shorten a row in the live store.
    s.archer.value!.ends[2] = [null, null]
    s.select(2, 2)
    expect(s.selected.value).toEqual({ row: 1, col: 0 })
    s.select(2, 1)
    expect(s.selected.value).toEqual({ row: 2, col: 1 })
  })
})

describe('activeRowRef', () => {
  function rowEl() {
    const el = document.createElement('tr')
    const scrollIntoView = vi.fn()
    el.scrollIntoView = scrollIntoView
    return { el, scrollIntoView }
  }

  it('scrolls the first registered row into view with block: nearest', async () => {
    seed()
    const s = useScoring('s1', 'a1')
    const { el, scrollIntoView } = rowEl()
    s.activeRowRef.value = el
    await nextTick()
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })
  })

  it('scrolls again when a different row element is registered', async () => {
    seed()
    const s = useScoring('s1', 'a1')
    const a = rowEl()
    const b = rowEl()
    s.activeRowRef.value = a.el
    await nextTick()
    s.activeRowRef.value = b.el
    await nextTick()
    expect(a.scrollIntoView).toHaveBeenCalledOnce()
    expect(b.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })
  })

  it('does not scroll again when the same element is re-registered', async () => {
    seed()
    const s = useScoring('s1', 'a1')
    const a = rowEl()
    s.activeRowRef.value = a.el
    await nextTick()
    s.activeRowRef.value = a.el
    await nextTick()
    expect(a.scrollIntoView).toHaveBeenCalledOnce()
  })

  it('ignores null and elements without scrollIntoView', async () => {
    seed()
    const s = useScoring('s1', 'a1')
    s.activeRowRef.value = null
    await nextTick()
    const el = document.createElement('tr')
    Object.defineProperty(el, 'scrollIntoView', { value: undefined })
    s.activeRowRef.value = el
    await expect(nextTick()).resolves.toBeUndefined()
  })
})
