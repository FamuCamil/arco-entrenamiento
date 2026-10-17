import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { STORAGE_KEY } from '@/composables/usePersistence'
import type { Session } from '@/domain/types'
import appRouter from '@/router'
import { makeSession, makeState } from '../../tests/fixtures'
import SummaryView from './SummaryView.vue'

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})

afterEach(() => {
  document.body.innerHTML = ''
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

function seed(session: Session = makeSession()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
}

async function view(id = 's1', archerId?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/session/:id/score/:archerId',
        name: 'scoring',
        component: { template: '<div />' },
      },
      { path: '/session/:id/summary', name: 'summary', component: { template: '<div />' } },
      { path: '/session/:id/edit', name: 'edit-session', component: { template: '<div />' } },
    ],
  })
  await router.push({
    name: 'summary',
    params: { id },
    query: archerId ? { archer: archerId } : {},
  })
  const w = mount(SummaryView, {
    props: { id, archerId },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

const text = (w: Awaited<ReturnType<typeof view>>, id: string) =>
  w.get(`[data-testid="${id}"]`).text()

/** WA 40 2×10×3 with X 10 9 in ends 0 and 1, and 8 M in end 10 (series 2). */
function seedScored(overrides: Partial<Session> = {}) {
  const s = makeSession(overrides)
  s.archers[0]!.ends[0] = ['X', '10', '9']
  s.archers[0]!.ends[1] = ['X', '10', '9']
  s.archers[0]!.ends[10] = ['8', 'M', null]
  seed(s)
  return s
}

describe('SummaryView header', () => {
  it('shows «Resumen», archer, date · place, distance · face', async () => {
    seedScored()
    const w = await view()
    expect(w.get('h2').text()).toBe('Resumen')
    expect(text(w, 'summary-archer')).toBe('A - Yo')
    expect(text(w, 'summary-date-place')).toBe('15/10/2026 · Club')
    expect(text(w, 'summary-distance-face')).toBe('18 m · WA 40 cm')
    expect(w.find('[data-testid="summary-status"]').exists()).toBe(false)
  })

  it('a blank place reads «Sin lugar»; a trimmed place is shown trimmed', async () => {
    seed(makeSession({ location: '   ' }))
    let w = await view()
    expect(text(w, 'summary-date-place')).toBe('15/10/2026 · Sin lugar')
    w.unmount()

    localStorage.clear()
    setActivePinia(createPinia())
    seed(makeSession({ location: '  Polideportivo  ' }))
    w = await view()
    expect(w.get('.summary-place').text()).toBe('Polideportivo')
  })

  it('distance 0 reads «Variable»; field and 3D show their catalogue names', async () => {
    seed(makeSession({ distance: 0, faceId: 'wa-field' }))
    let w = await view()
    expect(text(w, 'summary-distance-face')).toBe('Variable · WA Campo')
    w.unmount()

    localStorage.clear()
    setActivePinia(createPinia())
    seed(makeSession({ distance: 0, faceId: '3d' }))
    w = await view()
    expect(text(w, 'summary-distance-face')).toBe('Variable · 3D')
  })

  it('a closed session shows «Finalizada» with the lock icon', async () => {
    seedScored({ closed: true })
    const w = await view()
    const status = w.get('[data-testid="summary-status"]')
    expect(status.text()).toBe('Finalizada')
    expect(status.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('focuses the heading on mount', async () => {
    seedScored()
    const w = await view()
    const heading = w.get('h2')
    expect(heading.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(heading.element)
  })
})

describe('SummaryView table and footer', () => {
  it('totals, tiebreak counts and average match the scoring screen', async () => {
    seedScored()
    const w = await view()
    expect(w.get('table').attributes('aria-label')).toBe('Resumen por tandas')
    expect(w.findAll('tbody')).toHaveLength(2)
    expect(text(w, 'summary-end-total-0')).toBe('29/30')
    expect(text(w, 'summary-running-total-1')).toBe('58')
    expect(text(w, 'summary-end-total-2')).toBe('')
    expect(text(w, 'summary-end-total-10')).toBe('8/30')
    expect(text(w, 'summary-series-total-0')).toBe('Total Serie 1: 58/300')
    expect(text(w, 'summary-series-total-1')).toBe('Total Serie 2: 8/300')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 66/600')
    expect(
      w
        .findAll('thead th')
        .map((t) => t.attributes('aria-label'))
        .slice(3),
    ).toEqual(['Flechas de 10', 'Flechas de 9'])
    expect(text(w, 'summary-count-0-0')).toBe('2')
    expect(text(w, 'summary-count-0-1')).toBe('1')
    expect(text(w, 'summary-count-10-0')).toBe('0')
    expect(text(w, 'summary-count-2-0')).toBe('')
    expect(text(w, 'summary-series-count-0-0')).toBe('4')
    expect(text(w, 'summary-series-count-0-1')).toBe('2')
    expect(text(w, 'summary-grand-count-0')).toBe('4')
    expect(text(w, 'summary-grand-count-1')).toBe('2')
    // Same averageLabel as scoring («Promedio: …», with colon): 66 / 8.
    expect(text(w, 'summary-average')).toBe('Promedio: 8.25')
  })

  it('zone distribution: every zone in catalogue order with its colors; sum = arrows shot', async () => {
    seedScored()
    const w = await view()
    expect(w.get('h3').text()).toBe('Reparto por zonas')
    const list = w.get('ul')
    expect(list.attributes('aria-labelledby')).toBe(w.get('h3').attributes('id'))
    const items = list.findAll('li')
    expect(items.map((li) => li.attributes('data-testid'))).toEqual(
      ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'].map((k) => `zone-count-${k}`),
    )
    const count = (key: string) => w.get(`[data-testid="zone-count-${key}"] .zone-count`).text()
    expect([count('X'), count('10'), count('9'), count('8'), count('M'), count('7')]).toEqual([
      '2',
      '2',
      '2',
      '1',
      '1',
      '0',
    ])
    expect(items.reduce((s, li) => s + Number(li.get('.zone-count').text()), 0)).toBe(8)
    const chip = w.get('[data-testid="zone-count-X"] .zone-chip')
    expect(chip.text()).toBe('X')
    expect(chip.attributes('style')).toContain('background: rgb(250, 204, 21)')
    expect(chip.attributes('style')).toContain('color: rgb(17, 24, 39)')
  })

  it('zero-arrow session: blank ends, «0» counts, «Promedio: —», distribution all 0', async () => {
    seed()
    const w = await view()
    for (const row of [0, 9, 19]) {
      expect(text(w, `summary-end-total-${row}`)).toBe('')
      expect(text(w, `summary-running-total-${row}`)).toBe('')
      expect(text(w, `summary-count-${row}-0`)).toBe('')
      expect(text(w, `summary-count-${row}-1`)).toBe('')
    }
    expect(text(w, 'summary-series-total-0')).toBe('Total Serie 1: 0/300')
    expect(text(w, 'summary-series-count-0-0')).toBe('0')
    expect(text(w, 'summary-series-count-1-1')).toBe('0')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 0/600')
    expect(text(w, 'summary-grand-count-0')).toBe('0')
    expect(text(w, 'summary-grand-count-1')).toBe('0')
    expect(text(w, 'summary-average')).toBe('Promedio: —')
    const counts = w.findAll('.zone-count').map((c) => c.text())
    expect(counts).toHaveLength(12)
    expect(counts.every((c) => c === '0')).toBe(true)
  })

  it('field: X counts in «6»; columns «6» and «5»', async () => {
    const s = makeSession({ faceId: 'wa-field', distance: 0 })
    s.archers[0]!.ends[0] = ['X', '6', '5']
    seed(s)
    const w = await view()
    expect(
      w
        .findAll('thead th')
        .map((t) => t.text())
        .slice(3),
    ).toEqual(['6', '5'])
    expect(text(w, 'summary-end-total-0')).toBe('17/18')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 17/360')
    expect(text(w, 'summary-count-0-0')).toBe('2')
    expect(text(w, 'summary-count-0-1')).toBe('1')
    expect(text(w, 'summary-average')).toBe('Promedio: 5.67')
    expect(w.get('[data-testid="zone-count-X"] .zone-count').text()).toBe('1')
    expect(w.get('[data-testid="zone-count-6"] .zone-count').text()).toBe('1')
  })

  it('3D: columns «11» and «10», totals by points', async () => {
    const s = makeSession({ faceId: '3d', seriesCount: 1, endsPerSeries: 2, arrowsPerEnd: 2 })
    s.archers[0]!.ends = [
      ['11', '5'],
      ['10', 'M'],
    ]
    seed(s)
    const w = await view()
    expect(
      w
        .findAll('thead th')
        .map((t) => t.text())
        .slice(3),
    ).toEqual(['11', '10'])
    expect(w.findAll('tbody')).toHaveLength(1)
    expect(text(w, 'summary-end-total-0')).toBe('16/22')
    expect(text(w, 'summary-running-total-1')).toBe('26')
    expect(text(w, 'summary-series-total-0')).toBe('Total Serie 1: 26/44')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 26/44')
    expect(text(w, 'summary-grand-count-0')).toBe('1')
    expect(text(w, 'summary-grand-count-1')).toBe('1')
    expect(text(w, 'summary-average')).toBe('Promedio: 6.50')
    expect(w.findAll('li').map((li) => li.attributes('data-testid'))).toEqual(
      ['11', '10', '8', '5', 'M'].map((k) => `zone-count-${k}`),
    )
  })
})

describe('SummaryView archer selection and navigation', () => {
  function twoArchers() {
    const s = makeSession()
    s.archers.push({
      id: 'a2',
      name: 'Otra',
      position: 'B',
      ends: s.archers[0]!.ends.map(() => [null, null, null]),
    })
    s.archers[1]!.ends[0] = ['9', '9', '9']
    seed(s)
  }

  it('without ?archer uses the first archer', async () => {
    twoArchers()
    const w = await view()
    expect(text(w, 'summary-archer')).toBe('A - Yo')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 0/600')
  })

  it('?archer picks that archer and its figures', async () => {
    twoArchers()
    const w = await view('s1', 'a2')
    expect(text(w, 'summary-archer')).toBe('B - Otra')
    expect(text(w, 'summary-grand-total')).toBe('TOTAL GENERAL: 27/600')
    expect(text(w, 'summary-grand-count-1')).toBe('3')
    expect(w.get('[data-testid="summary-back"]').attributes('href')).toBe('/session/s1/score/a2')
  })

  it('open session: «Volver a anotar» to the archer’s scoring screen and «Inicio» home', async () => {
    seedScored()
    const w = await view()
    const back = w.get('[data-testid="summary-back"]')
    expect(back.element.tagName).toBe('A')
    expect(back.text()).toBe('Volver a anotar')
    expect(back.attributes('href')).toBe('/session/s1/score/a1')
    const home = w.get('[data-testid="summary-home"]')
    expect(home.text()).toBe('Inicio')
    expect(home.attributes('href')).toBe('/')
    expect(w.get('nav').attributes('aria-label')).toBe('Navegación del resumen')
  })

  it('closed session: the back link reads «Ver tabla»', async () => {
    seedScored({ closed: true })
    const w = await view()
    const back = w.get('[data-testid="summary-back"]')
    expect(back.text()).toBe('Ver tabla')
    expect(back.attributes('href')).toBe('/session/s1/score/a1')
  })

  it('is read-only: no buttons, inputs or store writes', async () => {
    seedScored()
    const before = localStorage.getItem(STORAGE_KEY)
    const w = await view()
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('select').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
    await flushPromises()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })
})

describe('SummaryView edit link and notes (CU-11)', () => {
  it.each([false, true])(
    '«Editar datos» links to the edit screen (closed = %s)',
    async (closed) => {
      seedScored({ closed })
      const w = await view()
      const edit = w.get('[data-testid="summary-edit"]')
      expect(edit.element.tagName).toBe('A')
      expect(edit.text()).toBe('Editar datos')
      expect(edit.attributes('href')).toBe('/session/s1/edit')
      expect(edit.classes()).toContain('nav-link')
      expect(edit.element.parentElement).toBe(w.get('nav').element)
    },
  )

  it('non-blank notes show in a «Notas» block, trimmed, with line breaks kept', async () => {
    seed(makeSession({ notes: '  Viento fuerte\nSegunda línea  ' }))
    const w = await view()
    const notes = w.get('[data-testid="summary-notes"]')
    expect(notes.element.textContent).toBe('Viento fuerte\nSegunda línea')
    expect(notes.classes()).toContain('summary-notes')
    const section = notes.element.closest('section[aria-labelledby]')!
    const title = document.getElementById(section.getAttribute('aria-labelledby')!)!
    expect(title.tagName).toBe('H3')
    expect(title.textContent).toBe('Notas')
  })

  it.each(['', '   ', '\n\t '])('no notes block for blank notes %j', async (notes) => {
    seed(makeSession({ notes }))
    const w = await view()
    expect(w.find('[data-testid="summary-notes"]').exists()).toBe(false)
    expect(w.findAll('h3').map((h) => h.text())).toEqual(['Reparto por zonas'])
  })

  it('notes are plain text, never HTML', async () => {
    seed(makeSession({ notes: '<b>negrita</b>' }))
    const w = await view()
    const notes = w.get('[data-testid="summary-notes"]')
    expect(notes.text()).toBe('<b>negrita</b>')
    expect(notes.find('b').exists()).toBe(false)
  })
})

describe('SummaryView not found', () => {
  it('an unknown session shows «No se encontró la sesión.» with a link home', async () => {
    seed()
    const w = await view('nope')
    expect(w.text()).toContain('No se encontró la sesión.')
    const link = w.get('a')
    expect(link.text()).toBe('Volver al inicio')
    expect(link.attributes('href')).toBe('/')
    expect(w.find('table').exists()).toBe(false)
  })

  it('a session with an unknown face shows «No se encontró la sesión.»', async () => {
    seed(makeSession({ faceId: 'missing-face' }))
    const w = await view()
    expect(w.text()).toContain('No se encontró la sesión.')
    expect(w.find('table').exists()).toBe(false)
  })

  it('an unknown ?archer shows «No se encontró el arquero.» with a link home', async () => {
    seed()
    const w = await view('s1', 'nope')
    expect(w.text()).toContain('No se encontró el arquero.')
    expect(w.text()).not.toContain('No se encontró la sesión.')
    expect(w.get('a').attributes('href')).toBe('/')
    expect(w.find('table').exists()).toBe(false)
  })
})

describe('summary route', () => {
  it('is named «summary», lazy, and normalises ?archer into props', async () => {
    const route = appRouter.getRoutes().find((r) => r.name === 'summary')!
    expect(route.path).toBe('/session/:id/summary')
    expect(typeof route.components!.default).toBe('function')
    const props = route.props.default as (r: unknown) => unknown
    const at = (query: Record<string, unknown>) => props({ params: { id: 's1' }, query })
    expect(at({ archer: 'a2' })).toEqual({ id: 's1', archerId: 'a2' })
    expect(at({})).toEqual({ id: 's1', archerId: undefined })
    expect(at({ archer: ['a1', 'a2'] })).toEqual({ id: 's1', archerId: undefined })
  })
})
