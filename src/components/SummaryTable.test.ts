import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SummaryTable from './SummaryTable.vue'

type Props = InstanceType<typeof SummaryTable>['$props']

/** WA 40 2×2×3: series 1 has 27 + 19, series 2 is unstarted. */
function props(overrides: Partial<Props> = {}): Props {
  return {
    endsPerSeries: 2,
    rowCount: 4,
    endTotals: [27, 19, null, null],
    runningTotals: [27, 46, null, null],
    seriesTotals: [46, 0],
    grandTotal: 46,
    endMax: 30,
    seriesMax: 60,
    grandMax: 120,
    tiebreakPoints: [10, 9],
    endCounts: [
      [1, 1],
      [1, 1],
      [0, 0],
      [0, 0],
    ],
    seriesCounts: [
      [2, 2],
      [0, 0],
    ],
    grandCounts: [2, 2],
    ...overrides,
  }
}

const table = (overrides: Partial<Props> = {}) => mount(SummaryTable, { props: props(overrides) })

const text = (w: ReturnType<typeof table>, id: string) => w.get(`[data-testid="${id}"]`).text()

describe('SummaryTable', () => {
  it('is one semantic table named «Resumen por tandas»', () => {
    const w = table()
    expect(w.findAll('table')).toHaveLength(1)
    expect(w.get('table').attributes('aria-label')).toBe('Resumen por tandas')
    expect(w.find('thead').exists()).toBe(true)
    expect(w.find('tfoot').exists()).toBe(true)
  })

  it('head: T., Total, Acum. and one column per tiebreak value, all scope="col"', () => {
    const w = table()
    const th = w.findAll('thead th')
    expect(th.map((t) => t.text())).toEqual(['T.', 'Total', 'Acum.', '10', '9'])
    expect(th.every((t) => t.attributes('scope') === 'col')).toBe(true)
    expect(th[0]!.get('abbr').attributes('title')).toBe('Tanda')
    expect(th[2]!.get('abbr').attributes('title')).toBe('Acumulado')
    expect(th[3]!.attributes('aria-label')).toBe('Flechas de 10')
    expect(th[4]!.attributes('aria-label')).toBe('Flechas de 9')
    expect(w.findAll('col')).toHaveLength(5)
  })

  it('headers show the points of the face (3D: 11 and 10)', () => {
    const w = table({ tiebreakPoints: [11, 10] })
    expect(w.findAll('thead th').map((t) => t.attributes('aria-label'))).toEqual([
      undefined,
      undefined,
      undefined,
      'Flechas de 11',
      'Flechas de 10',
    ])
  })

  it('one tbody per series with a «Serie n» rowgroup header and numbered ends', () => {
    const w = table()
    const bodies = w.findAll('tbody')
    expect(bodies).toHaveLength(2)
    for (const [s, body] of bodies.entries()) {
      const title = body.get('th.series-title')
      expect(title.text()).toBe(`Serie ${s + 1}`)
      expect(title.attributes('scope')).toBe('rowgroup')
      expect(title.attributes('colspan')).toBe('5')
      const endHeaders = body
        .findAll('tr')
        .slice(1, -1)
        .map((r) => r.get('th'))
      expect(endHeaders.map((h) => h.text())).toEqual(['1', '2'])
      expect(endHeaders.every((h) => h.attributes('scope') === 'row')).toBe(true)
    }
  })

  it('end rows: total/max, running total and counts', () => {
    const w = table()
    expect(text(w, 'summary-end-total-0')).toBe('27/30')
    expect(text(w, 'summary-running-total-0')).toBe('27')
    expect(text(w, 'summary-end-total-1')).toBe('19/30')
    expect(text(w, 'summary-running-total-1')).toBe('46')
    expect(text(w, 'summary-count-0-0')).toBe('1')
    expect(text(w, 'summary-count-0-1')).toBe('1')
  })

  it('unstarted ends are blank, counts included', () => {
    const w = table()
    for (const row of [2, 3]) {
      expect(text(w, `summary-end-total-${row}`)).toBe('')
      expect(text(w, `summary-running-total-${row}`)).toBe('')
      expect(text(w, `summary-count-${row}-0`)).toBe('')
      expect(text(w, `summary-count-${row}-1`)).toBe('')
    }
  })

  it('series rows «Total Serie n: X/máx» with counts; scope="row" spanning 3 columns', () => {
    const w = table()
    const label = w.get('[data-testid="summary-series-total-0"]')
    expect(label.text()).toBe('Total Serie 1: 46/60')
    expect(label.element.tagName).toBe('TH')
    expect(label.attributes('scope')).toBe('row')
    expect(label.attributes('colspan')).toBe('3')
    expect(text(w, 'summary-series-total-1')).toBe('Total Serie 2: 0/60')
    expect(text(w, 'summary-series-count-0-0')).toBe('2')
    expect(text(w, 'summary-series-count-0-1')).toBe('2')
    expect(text(w, 'summary-series-count-1-0')).toBe('0')
  })

  it('tfoot «TOTAL GENERAL: X/máx» with the session counts', () => {
    const w = table()
    const grand = w.get('tfoot [data-testid="summary-grand-total"]')
    expect(grand.text()).toBe('TOTAL GENERAL: 46/120')
    expect(grand.attributes('scope')).toBe('row')
    expect(grand.attributes('colspan')).toBe('3')
    expect(text(w, 'summary-grand-count-0')).toBe('2')
    expect(text(w, 'summary-grand-count-1')).toBe('2')
  })

  it('zero-arrow session: blank end counts, «0» series and grand counts', () => {
    const w = table({
      endTotals: [null, null, null, null],
      runningTotals: [null, null, null, null],
      seriesTotals: [0, 0],
      grandTotal: 0,
      endCounts: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      seriesCounts: [
        [0, 0],
        [0, 0],
      ],
      grandCounts: [0, 0],
    })
    for (const row of [0, 1, 2, 3]) expect(text(w, `summary-count-${row}-0`)).toBe('')
    expect(text(w, 'summary-series-total-0')).toBe('Total Serie 1: 0/60')
    expect(text(w, 'summary-series-count-0-0')).toBe('0')
    expect(text(w, 'summary-series-count-1-1')).toBe('0')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 0/120')
    expect(text(w, 'summary-grand-count-0')).toBe('0')
    expect(text(w, 'summary-grand-count-1')).toBe('0')
  })

  it('one tiebreak value: 4 columns, rowgroup colspan 4', () => {
    const w = table({
      tiebreakPoints: [5],
      endCounts: [[1], [0], [0], [0]],
      seriesCounts: [[1], [0]],
      grandCounts: [1],
    })
    expect(w.findAll('thead th').map((t) => t.text())).toEqual(['T.', 'Total', 'Acum.', '5'])
    expect(w.get('th.series-title').attributes('colspan')).toBe('4')
    expect(w.find('[data-testid="summary-count-0-1"]').exists()).toBe(false)
    expect(text(w, 'summary-grand-count-0')).toBe('1')
    expect(w.findAll('tfoot td')).toHaveLength(1)
  })

  it('no tiebreak values: 3 columns and no count cells', () => {
    const w = table({
      tiebreakPoints: [],
      endCounts: [[], [], [], []],
      seriesCounts: [[], []],
      grandCounts: [],
    })
    expect(w.findAll('thead th').map((t) => t.text())).toEqual(['T.', 'Total', 'Acum.'])
    expect(w.get('th.series-title').attributes('colspan')).toBe('3')
    expect(w.find('[data-testid^="summary-count-"]').exists()).toBe(false)
    expect(w.findAll('tfoot td')).toHaveLength(0)
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 46/120')
  })

  it('a last series with fewer rows still groups by floor(row / endsPerSeries)', () => {
    const w = table({
      endsPerSeries: 3,
      rowCount: 4,
      seriesTotals: [46, 0],
    })
    const bodies = w.findAll('tbody')
    expect(bodies).toHaveLength(2)
    expect(bodies[0]!.findAll('tr')).toHaveLength(5)
    expect(bodies[1]!.findAll('tr')).toHaveLength(3)
    expect(bodies[1]!.findAll('tr')[1]!.get('th').text()).toBe('1')
  })

  it('has no buttons or inputs', () => {
    const w = table()
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('input').exists()).toBe(false)
  })
})
