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
  it('renders one table per series with caption «Serie n», 10 rows of 3 arrow cells and 2 totals', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    const tables = w.findAll('table')
    expect(tables).toHaveLength(2)
    expect(tables.map((t) => t.get('caption').text())).toEqual(['Serie 1', 'Serie 2'])
    for (const t of tables) {
      const rows = t.findAll('tbody tr')
      expect(rows).toHaveLength(10)
      for (const r of rows) {
        expect(r.findAll('td.score-cell')).toHaveLength(3)
        expect(r.findAll('td.total')).toHaveLength(2)
        expect(r.findAll('td')).toHaveLength(5)
      }
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

  it('has the end header, one column header per arrow, «Total» and «Acum.»', () => {
    const w = grid(ends(20, 3), { row: 0, col: 0 })
    expect(
      w
        .get('thead')
        .findAll('th')
        .map((th) => th.text()),
    ).toEqual(['T.', '1', '2', '3', 'Total', 'Acum.'])
    const abbrs = w.get('thead').findAll('abbr')
    expect(abbrs.map((a) => [a.text(), a.attributes('title')])).toEqual([
      ['T.', 'Tanda'],
      ['Acum.', 'Acumulado'],
    ])
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
    const tds = w.findAll('td.score-cell')
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

  it('not interactive (closed session): no buttons, values shown, no cell selected', () => {
    const e = ends(2, 3)
    e[0] = ['X', null, 'M']
    const w = grid(e, { row: 0, col: 0 }, vi.fn(), 10, false)
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
    // CU-10 AC4: the selection is hidden while read-only.
    expect(w.find('[aria-current]').exists()).toBe(false)
    expect(w.find('.is-selected').exists()).toBe(false)
    expect(w.find('.is-interactive').exists()).toBe(false)
  })

  it('interactive: the selected cell carries aria-current and is-selected', () => {
    const w = grid(ends(2, 3), { row: 1, col: 2 })
    const current = w.findAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('data-testid')).toBe('score-cell-1-2')
    expect(w.findAll('.is-selected')).toHaveLength(1)
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

  it('switching to not interactive keeps the totals', async () => {
    const e = ends(2, 3)
    e[0] = ['X', '9', null]
    const w = grid(e, { row: 0, col: 0 })
    await w.setProps({ endTotals: [19, null], runningTotals: [19, null], endMax: 30 })
    await w.setProps({ interactive: false })
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('19/30')
    expect(w.get('[data-testid="running-total-0"]').text()).toBe('19')
  })
})

describe('ScoreGrid totals', () => {
  function withStats(e: End[], endsPerSeries: number, stats: Record<string, unknown>) {
    return mount(ScoreGrid, {
      props: {
        ends: e,
        endsPerSeries,
        selected: { row: 0, col: 0 },
        registerActiveRow: vi.fn(),
        interactive: true,
        ...stats,
      },
    })
  }

  const stats = {
    endTotals: [27, 10, null, 21],
    runningTotals: [27, 37, null, 21],
    seriesTotals: [37, 21],
    grandTotal: 58,
    endMax: 30,
    seriesMax: 90,
    grandMax: 180,
  }

  it('each row shows «X/endMax» and the running total; null rows are blank', () => {
    const w = withStats(ends(6, 3), 3, stats)
    const text = (id: string) => w.get(`[data-testid="${id}"]`).text()
    expect(text('end-total-0')).toBe('27/30')
    expect(text('running-total-0')).toBe('27')
    expect(text('end-total-1')).toBe('10/30')
    expect(text('running-total-1')).toBe('37')
    expect(text('end-total-2')).toBe('')
    expect(text('running-total-2')).toBe('')
    expect(text('end-total-3')).toBe('21/30')
    expect(text('running-total-3')).toBe('21')
    // Missing entries (rows past the arrays) are blank too.
    expect(text('end-total-5')).toBe('')
    expect(text('running-total-5')).toBe('')
  })

  it('a 0 total is shown, not blanked', () => {
    const w = withStats(ends(2, 3), 2, { ...stats, endTotals: [0, null], runningTotals: [0, null] })
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('0/30')
    expect(w.get('[data-testid="running-total-0"]').text()).toBe('0')
  })

  it('the totals sit after the arrow cells and are not interactive', () => {
    const w = withStats(ends(6, 3), 3, stats)
    const cells = w.get('[data-testid="score-row-0"]').findAll('td')
    expect(cells.map((c) => c.attributes('data-testid'))).toEqual([
      'score-cell-0-0',
      'score-cell-0-1',
      'score-cell-0-2',
      'end-total-0',
      'running-total-0',
    ])
    for (const c of cells.slice(3)) {
      expect(c.findAll('button')).toHaveLength(0)
      expect(c.attributes('tabindex')).toBeUndefined()
    }
  })

  it('each series ends with a tfoot row «Total Serie n: X/seriesMax» spanning every column', () => {
    const w = withStats(ends(6, 3), 3, stats)
    const tables = w.findAll('table')
    expect(tables).toHaveLength(2)
    expect(tables[0]!.get('tfoot').text()).toBe('Total Serie 1: 37/90')
    expect(tables[1]!.get('tfoot').text()).toBe('Total Serie 2: 21/90')
    const td = w.get('[data-testid="series-total-1"]')
    expect(td.attributes('colspan')).toBe('6')
  })

  it('the grid ends with «TOTAL GENERAL: X/grandMax» after the last table', () => {
    const w = withStats(ends(6, 3), 3, stats)
    const grand = w.get('[data-testid="grand-total"]')
    expect(grand.text()).toBe('TOTAL GENERAL: 58/180')
    const children = Array.from(w.get('.score-grid').element.children)
    expect(children.at(-1)).toBe(grand.element)
  })

  it('without stats props: blank rows, zero series and grand totals', () => {
    const w = grid(ends(4, 3), { row: 0, col: 0 }, vi.fn(), 2)
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('')
    expect(w.get('[data-testid="running-total-3"]').text()).toBe('')
    expect(w.get('[data-testid="series-total-0"]').text()).toBe('Total Serie 1: 0/0')
    expect(w.get('[data-testid="series-total-1"]').text()).toBe('Total Serie 2: 0/0')
    expect(w.get('[data-testid="grand-total"]').text()).toBe('TOTAL GENERAL: 0/0')
  })

  it('6 arrows: a colgroup with end, 6 arrow, Total and Acum. columns; colspan 9', () => {
    const w = withStats(ends(2, 6), 2, { ...stats, endMax: 60 })
    const cols = w.get('table').findAll('colgroup col')
    expect(cols).toHaveLength(9)
    expect(cols[0]!.classes()).toContain('col-end')
    expect(cols[7]!.classes()).toContain('col-total')
    expect(cols[8]!.classes()).toContain('col-running')
    expect(w.get('[data-testid="series-total-0"]').attributes('colspan')).toBe('9')
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('27/60')
  })

  it('updates when the stats props change', async () => {
    const w = withStats(ends(2, 3), 2, {
      endTotals: [null, null],
      runningTotals: [null, null],
      seriesTotals: [0],
      grandTotal: 0,
      endMax: 30,
      seriesMax: 60,
      grandMax: 60,
    })
    await w.setProps({
      endTotals: [19, null],
      runningTotals: [19, null],
      seriesTotals: [19],
      grandTotal: 19,
    })
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('19/30')
    expect(w.get('[data-testid="series-total-0"]').text()).toBe('Total Serie 1: 19/60')
    expect(w.get('[data-testid="grand-total"]').text()).toBe('TOTAL GENERAL: 19/60')
  })
})

describe('ScoreGrid with more than 6 arrows (two lines per end)', () => {
  it('12 arrows: two header rows 1–6 / 7–12 with T., Total and Acum. spanning both', () => {
    const w = grid(ends(2, 12), { row: 0, col: 0 }, vi.fn(), 2)
    const table = w.get('table')
    expect(table.classes()).toContain('is-wrapped')
    const headRows = table.get('thead').findAll('tr')
    expect(headRows).toHaveLength(2)
    expect(headRows[0]!.findAll('th').map((th) => th.text())).toEqual([
      'T.',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      'Total',
      'Acum.',
    ])
    expect(headRows[1]!.findAll('th').map((th) => th.text())).toEqual([
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ])
    const spanned = headRows[0]!.findAll('th').filter((th) => th.attributes('rowspan') === '2')
    expect(spanned.map((th) => th.text())).toEqual(['T.', 'Total', 'Acum.'])
  })

  it('12 arrows: one tbody per end carrying score-row-N, with two lines of 6 cells', () => {
    const w = grid(ends(4, 12), { row: 0, col: 0 }, vi.fn(), 2)
    const table = w.findAll('table')[1]!
    const bodies = table.findAll('tbody')
    expect(bodies).toHaveLength(2)
    expect(bodies.map((b) => b.attributes('data-testid'))).toEqual(['score-row-2', 'score-row-3'])
    for (const body of bodies) {
      expect(body.classes()).toContain('end')
      const lines = body.findAll('tr')
      expect(lines).toHaveLength(2)
      expect(lines[0]!.findAll('td.score-cell')).toHaveLength(6)
      expect(lines[1]!.findAll('td.score-cell')).toHaveLength(6)
      expect(body.findAll('.filler')).toHaveLength(0)
    }
    expect(bodies[0]!.get('th[scope="row"]').text()).toBe('1')
    expect(bodies[1]!.get('th[scope="row"]').text()).toBe('2')
  })

  it('12 arrows: the end number and both totals span the two lines', () => {
    const w = grid(ends(2, 12), { row: 0, col: 0 }, vi.fn(), 2)
    const body = w.get('[data-testid="score-row-0"]')
    expect(body.get('th[scope="row"]').attributes('rowspan')).toBe('2')
    expect(body.get('[data-testid="end-total-0"]').attributes('rowspan')).toBe('2')
    expect(body.get('[data-testid="running-total-0"]').attributes('rowspan')).toBe('2')
  })

  it('12 arrows: cells keep their arrow order 0..11 and labels «flecha 1..12»', () => {
    const e = ends(2, 12)
    e[1] = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M']
    const w = grid(e, { row: 0, col: 0 }, vi.fn(), 2)
    const body = w.get('[data-testid="score-row-1"]')
    const cells = body.findAll('td.score-cell')
    expect(cells.map((c) => c.attributes('data-testid'))).toEqual(
      Array.from({ length: 12 }, (_, i) => `score-cell-1-${i}`),
    )
    expect(cells.map((c) => c.text())).toEqual(e[1])
    const labels = cells.map((c) => c.get('button').attributes('aria-label'))
    expect(labels[0]).toBe('Serie 1, tanda 2, flecha 1: X')
    expect(labels[6]).toBe('Serie 1, tanda 2, flecha 7: 5')
    expect(labels[11]).toBe('Serie 1, tanda 2, flecha 12: fallo')
  })

  it('12 arrows: a colgroup of end, 6 arrow, Total and Acum. columns; tfoot colspan 9', () => {
    const w = grid(ends(2, 12), { row: 0, col: 0 }, vi.fn(), 2)
    const cols = w.get('table').findAll('colgroup col')
    expect(cols).toHaveLength(9)
    expect(cols[0]!.classes()).toContain('col-end')
    expect(cols[7]!.classes()).toContain('col-total')
    expect(cols[8]!.classes()).toContain('col-running')
    expect(w.get('[data-testid="series-total-0"]').attributes('colspan')).toBe('9')
  })

  it('7 arrows: 4 cells on line 1, 3 cells plus an aria-hidden filler on line 2', () => {
    const w = grid(ends(2, 7), { row: 0, col: 0 }, vi.fn(), 2)
    const headRows = w.get('thead').findAll('tr')
    expect(headRows[0]!.findAll('th').map((th) => th.text())).toEqual([
      'T.',
      '1',
      '2',
      '3',
      '4',
      'Total',
      'Acum.',
    ])
    const secondHead = headRows[1]!.findAll('th')
    expect(secondHead.map((th) => th.text())).toEqual(['5', '6', '7', ''])
    expect(secondHead[3]!.attributes('aria-hidden')).toBe('true')

    const lines = w.get('[data-testid="score-row-0"]').findAll('tr')
    expect(lines[0]!.findAll('td.score-cell').map((c) => c.attributes('data-testid'))).toEqual([
      'score-cell-0-0',
      'score-cell-0-1',
      'score-cell-0-2',
      'score-cell-0-3',
    ])
    expect(lines[1]!.findAll('td.score-cell').map((c) => c.attributes('data-testid'))).toEqual([
      'score-cell-0-4',
      'score-cell-0-5',
      'score-cell-0-6',
    ])
    const filler = lines[1]!.get('td.filler')
    expect(filler.attributes('aria-hidden')).toBe('true')
    expect(filler.findAll('button')).toHaveLength(0)
    expect(w.get('table').findAll('colgroup col')).toHaveLength(7)
    expect(w.get('[data-testid="series-total-0"]').attributes('colspan')).toBe('7')
  })

  it('marks exactly the selected cell, also on the second line', () => {
    const w = grid(ends(4, 12), { row: 3, col: 8 }, vi.fn(), 2)
    const current = w.findAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('data-testid')).toBe('score-cell-3-8')
  })

  it('registers the selected end tbody, and the new one when the row changes', async () => {
    const register = vi.fn()
    const w = grid(ends(4, 12), { row: 0, col: 0 }, register, 2)
    const body0 = w.get('[data-testid="score-row-0"]').element
    expect(body0.tagName).toBe('TBODY')
    expect(register).toHaveBeenLastCalledWith(body0)
    await w.setProps({ selected: { row: 0, col: 7 } })
    expect(register).toHaveBeenLastCalledWith(body0)
    await w.setProps({ selected: { row: 2, col: 0 } })
    expect(register).toHaveBeenLastCalledWith(w.get('[data-testid="score-row-2"]').element)
  })

  it('clicking a second-line cell emits select with its arrow index', async () => {
    const w = grid(ends(2, 12), { row: 0, col: 0 }, vi.fn(), 2)
    await w.get('[data-testid="score-cell-1-9"] button').trigger('click')
    await w.get('[data-testid="score-cell-1-2"] button').trigger('click')
    expect(w.emitted('select')).toEqual([
      [1, 9],
      [1, 2],
    ])
  })

  it('shows «X/endMax» totals and is not interactive when closed', () => {
    const w = mount(ScoreGrid, {
      props: {
        ends: [Array.from({ length: 12 }, () => '11'), Array.from({ length: 12 }, () => null)],
        endsPerSeries: 2,
        selected: { row: 1, col: 0 },
        registerActiveRow: vi.fn(),
        interactive: false,
        endTotals: [132, null],
        runningTotals: [132, null],
        seriesTotals: [132],
        grandTotal: 132,
        endMax: 132,
        seriesMax: 264,
        grandMax: 264,
      },
    })
    expect(w.get('[data-testid="end-total-0"]').text()).toBe('132/132')
    expect(w.get('[data-testid="running-total-0"]').text()).toBe('132')
    expect(w.get('[data-testid="end-total-1"]').text()).toBe('')
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.get('[data-testid="score-cell-0-11"]').text()).toBe('11')
  })

  it('6 arrows stay on one line: one tbody, one header row, no rowspans', () => {
    const w = grid(ends(2, 6), { row: 0, col: 0 }, vi.fn(), 2)
    const table = w.get('table')
    expect(table.classes()).not.toContain('is-wrapped')
    expect(table.findAll('tbody')).toHaveLength(1)
    expect(table.get('thead').findAll('tr')).toHaveLength(1)
    expect(table.findAll('[rowspan]')).toHaveLength(0)
    expect(w.get('[data-testid="score-row-0"]').element.tagName).toBe('TR')
  })
})
