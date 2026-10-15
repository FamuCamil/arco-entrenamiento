import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { Cell, End } from '@/domain/types'
import ScoreGrid from './ScoreGrid.vue'

function ends(rows: number, arrows: number): End[] {
  return Array.from({ length: rows }, () => Array.from({ length: arrows }, () => null))
}

function grid(
  e: End[],
  selected: Cell,
  registerActiveRow = vi.fn(),
  endsPerSeries = 10,
  interactive = true,
) {
  return mount(ScoreGrid, {
    props: { ends: e, endsPerSeries, selected, registerActiveRow, interactive },
  })
}

describe('ScoreGrid', () => {
  it('renders one table per series with caption «Serie n», 10 rows of 3 cells', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    const tables = w.findAll('table')
    expect(tables).toHaveLength(2)
    expect(tables.map((t) => t.get('caption').text())).toEqual(['Serie 1', 'Serie 2'])
    for (const t of tables) {
      const rows = t.findAll('tbody tr')
      expect(rows).toHaveLength(10)
      for (const r of rows) expect(r.findAll('td')).toHaveLength(3)
    }
  })

  it('numbers ends 1..endsPerSeries within each series', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    for (const t of w.findAll('table')) {
      expect(t.findAll('tbody th[scope="row"]').map((th) => th.text())).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
      ])
    }
  })

  it('has one column header per arrow', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    expect(
      w
        .get('thead')
        .findAll('th')
        .map((th) => th.text()),
    ).toEqual(['Tanda', '1', '2', '3'])
  })

  it('exposes row and cell test ids with global row indexes', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    expect(w.find('[data-testid="score-row-19"]').exists()).toBe(true)
    expect(w.find('[data-testid="score-cell-19-2"]').element.tagName).toBe('TD')
    expect(w.find('[data-testid="score-row-20"]').exists()).toBe(false)
  })

  it('shows cell values and blanks for empty cells', () => {
    const e = ends(2, 3)
    e[0] = ['X', null, 'M']
    const w = grid(e, { row: 1, col: 0 })
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
  })

  it('marks exactly the selected cell with aria-current="true"', () => {
    const w = grid(ends(20, 3), { row: 12, col: 1 })
    const current = w.findAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('data-testid')).toBe('score-cell-12-1')
    expect(current[0]!.classes()).toContain('is-selected')
  })

  it('registers the selected row element, and the new one when the row changes', async () => {
    const register = vi.fn()
    const w = grid(ends(20, 3), { row: 0, col: 0 }, register)
    expect(register).toHaveBeenLastCalledWith(w.get('[data-testid="score-row-0"]').element)
    await w.setProps({ selected: { row: 11, col: 0 } })
    expect(register).toHaveBeenLastCalledWith(w.get('[data-testid="score-row-11"]').element)
  })

  it('interactive: each cell holds one focusable native button and no tabindex hacks', () => {
    const w = grid(ends(2, 3), { row: 0, col: 0 })
    const tds = w.findAll('td')
    expect(tds).toHaveLength(6)
    for (const td of tds) {
      const buttons = td.findAll('button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0]!.attributes('type')).toBe('button')
      expect(buttons[0]!.attributes('tabindex')).toBeUndefined()
      expect(buttons[0]!.attributes('disabled')).toBeUndefined()
      expect(td.attributes('tabindex')).toBeUndefined()
      expect(td.attributes('role')).toBeUndefined()
    }
  })

  it('not interactive (closed session): no buttons, values still shown', () => {
    const e = ends(2, 3)
    e[0] = ['X', null, 'M']
    const w = grid(e, { row: 0, col: 0 }, vi.fn(), 10, false)
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
    expect(w.findAll('[aria-current="true"]')).toHaveLength(1)
  })

  it('clicking a cell emits select with the global row index and the arrow', async () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    await w.get('[data-testid="score-cell-13-2"] button').trigger('click')
    await w.get('[data-testid="score-cell-0-1"] button').trigger('click')
    expect(w.emitted('select')).toEqual([
      [13, 2],
      [0, 1],
    ])
  })

  it('clicking a cell does not move aria-current by itself (the parent owns the selection)', async () => {
    const w = grid(ends(2, 3), { row: 0, col: 0 })
    await w.get('[data-testid="score-cell-1-2"] button').trigger('click')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-0-0')
  })

  it('labels cells with series, end, arrow and value («fallo» for M, «vacía» for empty)', () => {
    const e = ends(20, 3)
    e[0] = ['X', 'M', null]
    e[13] = [null, '7', null]
    const w = grid(e, { row: 0, col: 0 })
    const label = (r: number, c: number) =>
      w.get(`[data-testid="score-cell-${r}-${c}"] button`).attributes('aria-label')
    expect(label(0, 0)).toBe('Serie 1, tanda 1, flecha 1: X')
    expect(label(0, 1)).toBe('Serie 1, tanda 1, flecha 2: fallo')
    expect(label(0, 2)).toBe('Serie 1, tanda 1, flecha 3: vacía')
    expect(label(13, 1)).toBe('Serie 2, tanda 4, flecha 2: 7')
    expect(label(19, 2)).toBe('Serie 2, tanda 10, flecha 3: vacía')
  })

  it('the label follows the value when it changes', async () => {
    const e = ends(2, 3)
    const w = grid(e, { row: 0, col: 0 })
    const btn = () => w.get('[data-testid="score-cell-0-0"] button')
    expect(btn().attributes('aria-label')).toBe('Serie 1, tanda 1, flecha 1: vacía')
    const next = ends(2, 3)
    next[0] = ['10', null, null]
    await w.setProps({ ends: next })
    expect(btn().attributes('aria-label')).toBe('Serie 1, tanda 1, flecha 1: 10')
    expect(btn().text()).toBe('10')
  })

  it('switching to not interactive removes the buttons', async () => {
    const w = grid(ends(2, 3), { row: 0, col: 0 })
    expect(w.findAll('button')).toHaveLength(6)
    await w.setProps({ interactive: false })
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('splits by endsPerSeries for other layouts', () => {
    const w = grid(ends(24, 2), { row: 0, col: 0 }, vi.fn(), 12)
    expect(w.findAll('table')).toHaveLength(2)
    expect(w.findAll('table')[1]!.findAll('tbody tr')).toHaveLength(12)
  })
})
