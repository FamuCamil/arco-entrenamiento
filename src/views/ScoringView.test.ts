import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { STORAGE_KEY } from '@/composables/usePersistence'
import type { Session } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import ScoringView from './ScoringView.vue'

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

function seed(session: Session = makeSession()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
}

async function view(id = 's1', archerId = 'a1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/session/:id/score/:archerId', component: ScoringView, props: true },
    ],
  })
  await router.push(`/session/${id}/score/${archerId}`)
  const w = mount(ScoringView, { props: { id, archerId }, global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('ScoringView', () => {
  it('shows the header «A - Yo», 2 series and the keypad', async () => {
    seed()
    const w = await view()
    expect(w.get('h2').text()).toBe('A - Yo')
    expect(w.findAll('table')).toHaveLength(2)
    expect(w.find('[role="group"][aria-label="Teclado de puntuación"]').exists()).toBe(true)
    expect(w.find('[role="status"]').exists()).toBe(false)
  })

  it('selects the first empty cell on entry', async () => {
    const s = makeSession()
    s.archers[0]!.ends[0] = ['X', '9', '8']
    s.archers[0]!.ends[1] = ['7', null, null]
    seed(s)
    const w = await view()
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-1-1')
  })

  it('selects the last cell when the session is full', async () => {
    const s = makeSession()
    s.archers[0]!.ends = s.archers[0]!.ends.map(() => ['X', 'X', 'X'])
    seed(s)
    const w = await view()
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-19-2')
  })

  it('pressing keys fills cells and advances the selection across ends', async () => {
    seed()
    const w = await view()
    for (const key of ['X', '9', 'M', '10'])
      await w.get(`[data-testid="key-${key}"]`).trigger('click')
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('9')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
    expect(w.get('[data-testid="score-cell-1-0"]').text()).toBe('10')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-1-1')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[0]).toEqual(['X', '9', 'M'])
  })

  it('scrolls the active row into view on entry and on row change', async () => {
    seed()
    const w = await view()
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(w.get('[data-testid="score-row-0"]').element)
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
    await w.get('[data-testid="key-X"]').trigger('click')
    await flushPromises()
    expect(scroll).toHaveBeenCalledTimes(1)
    await w.get('[data-testid="key-X"]').trigger('click')
    await w.get('[data-testid="key-X"]').trigger('click')
    await flushPromises()
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(scroll.mock.contexts[1]).toBe(w.get('[data-testid="score-row-1"]').element)
  })

  it('a closed session shows the lock instead of the keypad', async () => {
    seed(makeSession({ closed: true }))
    const w = await view()
    expect(w.get('[role="status"]').text()).toBe('Sesión finalizada — solo lectura')
    expect(w.find('[role="group"]').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.findAll('table')).toHaveLength(2)
  })

  it.each([
    ['an unknown session', 'nope', 'a1'],
    ['an unknown archer', 's1', 'nope'],
  ])('%s shows the not-found message with a link home', async (_, id, archerId) => {
    seed()
    const w = await view(id, archerId)
    expect(w.text()).toContain('No se encontró la sesión.')
    const link = w.get('a')
    expect(link.text()).toBe('Volver al inicio')
    expect(link.attributes('href')).toBe('/')
    expect(w.find('table').exists()).toBe(false)
    expect(w.find('[role="group"]').exists()).toBe(false)
  })

  it('a session with an unknown face shows the not-found message', async () => {
    seed(makeSession({ faceId: 'missing-face' }))
    const w = await view()
    expect(w.text()).toContain('No se encontró la sesión.')
  })
})
