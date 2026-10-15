import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useConfirm } from '@/composables/useConfirm'

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
  useConfirm().settle(false)
  document.body.innerHTML = ''
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

  it('completing an end out of order renders it sorted at once (CU-06)', async () => {
    seed()
    const w = await view()
    for (const key of ['7', 'M', 'X']) await w.get(`[data-testid="key-${key}"]`).trigger('click')
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('7')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-1-0')

    // A correction that moves the value: the selection advances from the touched cell.
    await w.get('[data-testid="score-cell-0-0"] button').trigger('click')
    await w.get('[data-testid="key-5"]').trigger('click')
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('7')
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('5')
    expect(w.get('[data-testid="score-cell-0-2"]').text()).toBe('M')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-0-1')
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

  it('cells are buttons named by series, end, arrow and value', async () => {
    const s = makeSession()
    s.archers[0]!.ends[0] = ['X', 'M', null]
    seed(s)
    const w = await view()
    expect(w.findAll('table button')).toHaveLength(60)
    const name = (r: number, c: number) =>
      w.get(`[data-testid="score-cell-${r}-${c}"] button`).attributes('aria-label')
    expect(name(0, 0)).toBe('Serie 1, tanda 1, flecha 1: X')
    expect(name(0, 1)).toBe('Serie 1, tanda 1, flecha 2: fallo')
    expect(name(0, 2)).toBe('Serie 1, tanda 1, flecha 3: vacía')
  })

  it('tapping a filled cell selects it; the next key overwrites it and advances', async () => {
    const s = makeSession()
    s.archers[0]!.ends[0] = ['X', '9', 'M']
    seed(s)
    const w = await view()
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-1-0')
    await w.get('[data-testid="score-cell-0-1"] button').trigger('click')
    const current = w.findAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('data-testid')).toBe('score-cell-0-1')
    expect(current[0]!.classes()).toContain('is-selected')
    expect(w.get('[data-testid="score-cell-1-0"]').classes()).not.toContain('is-selected')

    await w.get('[data-testid="key-7"]').trigger('click')
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('7')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-0-2')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[0]).toEqual(['X', '7', 'M'])
    expect(w.get('[data-testid="score-cell-0-1"] button').attributes('aria-label')).toBe(
      'Serie 1, tanda 1, flecha 2: 7',
    )
  })

  it('tapping an empty cell past the first gap writes out of order and leaves the gap', async () => {
    seed()
    const w = await view()
    await w.get('[data-testid="score-cell-2-2"] button').trigger('click')
    await w.get('[data-testid="key-10"]').trigger('click')
    expect(w.get('[data-testid="score-cell-2-2"]').text()).toBe('10')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-3-0')
    const ends = useSessionsStore().getArcher('s1', 'a1')!.ends
    expect(ends[0]).toEqual([null, null, null])
    expect(ends[2]).toEqual([null, null, '10'])
  })

  it('a closed session: no cell buttons, clicking a cell changes nothing', async () => {
    const s = makeSession({ closed: true })
    s.archers[0]!.ends[0] = ['X', '9', null]
    seed(s)
    const w = await view()
    const before = w.get('[aria-current="true"]').attributes('data-testid')
    expect(before).toBe('score-cell-0-2')
    expect(w.findAll('table button')).toHaveLength(0)
    await w.get('[data-testid="score-cell-0-0"]').trigger('click')
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe(before)
    expect(w.get('[data-testid="score-cell-0-0"]').text()).toBe('X')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[0]).toEqual(['X', '9', null])
  })

  it('with a gap left by out-of-order scoring, entry selects the first gap', async () => {
    const s = makeSession()
    s.archers[0]!.ends[0] = ['X', '9', '8']
    s.archers[0]!.ends[2] = ['7', '6', '5']
    seed(s)
    const w = await view()
    expect(w.get('[aria-current="true"]').attributes('data-testid')).toBe('score-cell-1-0')
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

/** ScoringView plus the dialog host, as App.vue mounts them, attached for focus checks. */
async function viewWithDialog() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/session/:id/score/:archerId', component: ScoringView, props: true }],
  })
  await router.push('/session/s1/score/a1')
  const Host = defineComponent(() => () => [
    h(ScoringView, { id: 's1', archerId: 'a1' }),
    h(ConfirmDialog),
  ])
  const w = mount(Host, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

function seedPartial() {
  const s = makeSession()
  s.archers[0]!.ends[0] = ['X', '9', '8']
  s.archers[0]!.ends[1] = ['7', '6', null]
  seed(s)
}

const selectedId = (w: { get: (s: string) => { attributes: (a: string) => string | undefined } }) =>
  w.get('[aria-current="true"]').attributes('data-testid')

describe('ScoringView delete actions', () => {
  it('shows «Borrar flecha» and «Borrar tanda» below the keypad', async () => {
    seedPartial()
    const w = await view()
    const group = w.get('[role="group"][aria-label="Acciones de borrado"]')
    expect(group.findAll('button').map((b) => b.text())).toEqual(['Borrar flecha', 'Borrar tanda'])
    const controls = w.get('.controls').element
    const keypad = w.get('[aria-label="Teclado de puntuación"]').element
    expect(keypad.compareDocumentPosition(group.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(controls.contains(group.element)).toBe(true)
  })

  it('disables both on an empty cell of an empty end; only «Borrar flecha» on a gap', async () => {
    seedPartial()
    const w = await view()
    // Entry selects the first gap: row 1, col 2 (end has values, cell empty).
    expect(selectedId(w)).toBe('score-cell-1-2')
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBe('true')
    expect(w.get('[data-testid="delete-end"]').attributes('aria-disabled')).toBeUndefined()
    await w.get('[data-testid="score-cell-2-0"] button').trigger('click')
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBe('true')
    expect(w.get('[data-testid="delete-end"]').attributes('aria-disabled')).toBe('true')
    await w.get('[data-testid="score-cell-0-0"] button').trigger('click')
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('«Borrar flecha» empties the selected cell without confirmation; selection stays', async () => {
    seedPartial()
    const w = await viewWithDialog()
    await w.get('[data-testid="score-cell-0-1"] button').trigger('click')
    await w.get('[data-testid="delete-arrow"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(w.get('[data-testid="score-cell-0-1"]').text()).toBe('')
    expect(selectedId(w)).toBe('score-cell-0-1')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[0]).toEqual(['X', null, '8'])
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBe('true')
    await flushPromises()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', null, '8'])
  })

  it('a disabled «Borrar flecha» changes nothing', async () => {
    seedPartial()
    const w = await view()
    await w.get('[data-testid="delete-arrow"]').trigger('click')
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[1]).toEqual(['7', '6', null])
    expect(selectedId(w)).toBe('score-cell-1-2')
  })

  it('«Borrar tanda» asks first; Cancelar changes neither values nor selection', async () => {
    seedPartial()
    const w = await viewWithDialog()
    await w.get('[data-testid="score-cell-1-1"] button').trigger('click')
    const endButton = w.get('[data-testid="delete-end"]')
    ;(endButton.element as HTMLButtonElement).focus()
    await endButton.trigger('click')
    await flushPromises()
    const dialog = w.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('¿Borrar la tanda?')
    expect(dialog.get('p').text()).toBe(
      'Se borrarán todas las flechas de la serie 1, tanda 2. No se puede deshacer.',
    )
    expect(dialog.findAll('button').map((b) => b.text())).toEqual(['Cancelar', 'Borrar'])
    await w.get('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(useSessionsStore().getArcher('s1', 'a1')!.ends[1]).toEqual(['7', '6', null])
    expect(selectedId(w)).toBe('score-cell-1-1')
    expect(document.activeElement).toBe(endButton.element)
  })

  it('«Borrar tanda» confirmed empties the end, selects its first arrow and refocuses', async () => {
    seedPartial()
    const w = await viewWithDialog()
    await w.get('[data-testid="score-cell-0-2"] button').trigger('click')
    await w.get('[data-testid="delete-end"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    const ends = useSessionsStore().getArcher('s1', 'a1')!.ends
    expect(ends[0]).toEqual([null, null, null])
    expect(ends[1]).toEqual(['7', '6', null])
    expect(selectedId(w)).toBe('score-cell-0-0')
    // returnFocusTo: focus goes back to «Borrar tanda» even though a tap did not focus it.
    expect(document.activeElement).toBe(w.get('[data-testid="delete-end"]').element)
    expect(w.get('[data-testid="delete-end"]').attributes('aria-disabled')).toBe('true')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sessions[0].archers[0].ends[0]).toEqual([null, null, null])
  })

  it('names series 2 ends correctly in the message', async () => {
    const s = makeSession()
    s.archers[0]!.ends[12] = ['5', null, null]
    seed(s)
    const w = await viewWithDialog()
    await w.get('[data-testid="score-cell-12-0"] button').trigger('click')
    await w.get('[data-testid="delete-end"]').trigger('click')
    await flushPromises()
    expect(w.get('[role="dialog"] p').text()).toBe(
      'Se borrarán todas las flechas de la serie 2, tanda 3. No se puede deshacer.',
    )
  })

  it('a disabled «Borrar tanda» opens no dialog', async () => {
    seedPartial()
    const w = await viewWithDialog()
    await w.get('[data-testid="score-cell-5-0"] button').trigger('click')
    await w.get('[data-testid="delete-end"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(useConfirm().state.value).toBeNull()
  })

  it('a closed session shows no delete actions', async () => {
    const s = makeSession({ closed: true })
    s.archers[0]!.ends[0] = ['X', '9', '8']
    seed(s)
    const w = await view()
    expect(w.find('[aria-label="Acciones de borrado"]').exists()).toBe(false)
    expect(w.find('[data-testid="delete-arrow"]').exists()).toBe(false)
    expect(w.find('[data-testid="delete-end"]').exists()).toBe(false)
  })
})
