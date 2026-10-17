import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { STORAGE_KEY } from '@/composables/usePersistence'
import { STRUCTURE_LOCKED_MESSAGE } from '@/domain/sessionForm'
import type { Session } from '@/domain/types'
import appRouter from '@/router'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import EditSessionView from './EditSessionView.vue'

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
  vi.useRealTimers()
})

function seed(session: Session = makeSession()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([session])))
  return session
}

function seedWithArrow(overrides: Partial<Session> = {}) {
  const s = makeSession(overrides)
  s.archers[0]!.ends[0] = ['X', '9', null]
  return seed(s)
}

const SUMMARY_WITH_ARCHER = '/session/s1/summary?archer=a1'

/** Mounts the edit screen; `fromSummary` pushes the summary first, as the «Editar datos» link does. */
async function view(id = 's1', fromSummary = false) {
  const router = await editRouter(id, fromSummary)
  const w = mount(EditSessionView, {
    props: { id },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { w, router }
}

/** A router already on the edit screen of `id`. */
async function editRouter(id: string, fromSummary: boolean) {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'sessions', component: stub },
      { path: '/session/:id/score/:archerId', name: 'scoring', component: stub },
      { path: '/session/:id/summary', name: 'summary', component: stub },
      { path: '/session/:id/edit', name: 'edit-session', component: stub },
    ],
  })
  await router.push('/')
  if (fromSummary) {
    await router.push(SUMMARY_WITH_ARCHER)
    await router.push({
      name: 'edit-session',
      params: { id },
      state: { back: SUMMARY_WITH_ARCHER },
    })
  } else {
    await router.push({ name: 'edit-session', params: { id } })
  }
  return router
}

type W = VueWrapper

const el = <T extends HTMLElement = HTMLInputElement>(w: W, id: string) =>
  w.get<T>(`#es-${id}`).element

function save(w: W) {
  return w.get<HTMLButtonElement>('button[type="submit"]')
}

async function submit(w: W) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('EditSessionView pre-fill', () => {
  it('shows «Editar sesión», focused, with every current value and no templates', async () => {
    seed(makeSession({ notes: 'Línea 1\nLínea 2', faceId: 'wa-80' }))
    const { w } = await view()
    const heading = w.get('h2')
    expect(heading.text()).toBe('Editar sesión')
    expect(heading.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(heading.element)
    expect(el(w, 'date').value).toBe('2026-10-15')
    expect(el(w, 'location').value).toBe('Club')
    expect(el(w, 'distance').value).toBe('18')
    expect(w.get<HTMLInputElement>('.checkbox input').element.checked).toBe(false)
    expect(el<HTMLSelectElement>(w, 'face').value).toBe('wa-80')
    expect(el(w, 'series').value).toBe('2')
    expect(el(w, 'ends').value).toBe('10')
    expect(el(w, 'arrows').value).toBe('3')
    expect(el<HTMLTextAreaElement>(w, 'notes').value).toBe('Línea 1\nLínea 2')
    expect(w.find('[aria-label="Plantillas"]').exists()).toBe(false)
    expect(w.findAll('label[for]')).toHaveLength(8)
    expect(save(w).text()).toBe('Guardar cambios')
    expect(save(w).element.disabled).toBe(false)
    expect(w.get('button.secondary').text()).toBe('Cancelar')
  })

  it('distance 0 shows «Variable» checked and the distance blank and disabled', async () => {
    seed(makeSession({ distance: 0 }))
    const { w } = await view()
    expect(w.get<HTMLInputElement>('.checkbox input').element.checked).toBe(true)
    expect(el(w, 'distance').value).toBe('')
    expect(el(w, 'distance').disabled).toBe(true)
  })

  it('an unknown face renders «Diana desconocida» selected, without crashing', async () => {
    seed(makeSession({ faceId: 'missing-face' }))
    const { w } = await view()
    const select = el<HTMLSelectElement>(w, 'face')
    expect(select.value).toBe('missing-face')
    expect(select.selectedOptions[0]!.text).toBe('Diana desconocida')
    expect(w.text()).not.toContain('No se encontró la sesión.')
  })
})

describe('EditSessionView structure lock', () => {
  it('without arrows: face and structure editable, no hint', async () => {
    seed()
    const { w } = await view()
    expect(w.find('[data-testid="structure-locked"]').exists()).toBe(false)
    for (const id of ['face', 'series', 'ends', 'arrows']) {
      expect(w.get(`#es-${id}`).attributes('disabled'), id).toBeUndefined()
    }
  })

  it('with one arrow: face and structure disabled and described by the hint', async () => {
    seedWithArrow()
    const { w } = await view()
    const hint = w.get('[data-testid="structure-locked"]')
    expect(hint.text()).toBe(STRUCTURE_LOCKED_MESSAGE)
    for (const id of ['face', 'series', 'ends', 'arrows']) {
      const control = w.get(`#es-${id}`)
      expect(control.attributes('disabled'), id).toBeDefined()
      expect(control.attributes('aria-describedby'), id).toBe(hint.attributes('id'))
    }
    for (const id of ['date', 'location', 'distance', 'notes']) {
      expect(w.get(`#es-${id}`).attributes('disabled'), id).toBeUndefined()
    }
  })
})

describe('EditSessionView errors', () => {
  it('13 arrows without arrows scored: message, aria-describedby, save disabled, nothing saved', async () => {
    seed()
    const { w, router } = await view()
    const before = localStorage.getItem(STORAGE_KEY)
    await w.get('#es-arrows').setValue('13')
    const message = w.get('#es-arrowsPerEnd-error')
    expect(message.text()).toBe('Entre 1 y 12 flechas')
    expect(w.get('#es-arrows').attributes('aria-describedby')).toBe('es-arrowsPerEnd-error')
    expect(w.get('#es-arrows').attributes('aria-invalid')).toBe('true')
    expect(save(w).element.disabled).toBe(true)
    await submit(w)
    expect(useSessionsStore().getSession('s1')!.arrowsPerEnd).toBe(3)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(router.currentRoute.value.name).toBe('edit-session')
  })

  it('an invalid date errors even with the structure locked', async () => {
    seedWithArrow()
    const { w } = await view()
    await w.get('#es-date').setValue('')
    expect(w.find('#es-date-error').exists()).toBe(true)
    expect(save(w).element.disabled).toBe(true)
  })

  it('unknown face without arrows asks to pick a catalogue face before saving', async () => {
    seed(makeSession({ faceId: 'missing-face' }))
    const { w } = await view()
    expect(w.find('#es-faceId-error').exists()).toBe(true)
    expect(save(w).element.disabled).toBe(true)
    await w.get('#es-face').setValue('wa-40')
    expect(w.find('#es-faceId-error').exists()).toBe(false)
    expect(save(w).element.disabled).toBe(false)
  })
})

describe('EditSessionView save', () => {
  it('saves every field without arrows, regenerates ends, and replaces with the summary on a direct visit', async () => {
    seed()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(9000)
    const { w, router } = await view()
    await w.get('#es-date').setValue('2026-10-20')
    await w.get('#es-location').setValue('  Polideportivo  ')
    await w.get('#es-arrows').setValue('5')
    await w.get('#es-notes').setValue('Viento\nfrío')
    await submit(w)
    const s = useSessionsStore().getSession('s1')!
    expect(s).toMatchObject({
      date: '2026-10-20',
      location: 'Polideportivo',
      arrowsPerEnd: 5,
      notes: 'Viento\nfrío',
      updatedAt: 9000,
    })
    expect(s.archers[0]!.ends[0]).toHaveLength(5)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions[0].arrowsPerEnd).toBe(5)
    expect(router.currentRoute.value.fullPath).toBe('/session/s1/summary')
    // replace: going back skips the edit form and lands on the entry before it.
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('coming from the summary, saving pops back to it with its ?archer', async () => {
    seed()
    const { w, router } = await view('s1', true)
    await w.get('#es-location').setValue('Otro')
    await submit(w)
    expect(useSessionsStore().getSession('s1')!.location).toBe('Otro')
    expect(router.currentRoute.value.fullPath).toBe(SUMMARY_WITH_ARCHER)
  })

  it('a back state pointing to another session’s summary replaces instead of popping', async () => {
    seed()
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub },
        { path: '/session/:id/summary', name: 'summary', component: stub },
        { path: '/session/:id/edit', name: 'edit-session', component: stub },
      ],
    })
    await router.push('/session/other/summary')
    await router.push({
      name: 'edit-session',
      params: { id: 's1' },
      state: { back: '/session/other/summary' },
    })
    const w = mount(EditSessionView, { props: { id: 's1' }, global: { plugins: [router] } })
    await flushPromises()
    await w.get('button.secondary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/session/s1/summary')
  })

  it('with an arrow scored, saves place and notes and keeps face, structure and arrows', async () => {
    seedWithArrow()
    const { w } = await view()
    await w.get('#es-location').setValue('Pabellón')
    await w.get('#es-notes').setValue('Bien')
    await submit(w)
    const s = useSessionsStore().getSession('s1')!
    expect(s).toMatchObject({
      location: 'Pabellón',
      notes: 'Bien',
      faceId: 'wa-40',
      arrowsPerEnd: 3,
    })
    expect(s.archers[0]!.ends[0]).toEqual(['X', '9', null])
  })

  it('locked legacy over-limit structure still saves place and notes', async () => {
    const s = makeSession({ seriesCount: 25, endsPerSeries: 2, arrowsPerEnd: 13 })
    s.archers[0]!.ends[0]![0] = '10'
    seed(s)
    const { w } = await view()
    expect(w.find('.error').exists()).toBe(false)
    await w.get('#es-location').setValue('Nuevo')
    await w.get('#es-notes').setValue('Legado')
    expect(save(w).element.disabled).toBe(false)
    await submit(w)
    expect(useSessionsStore().getSession('s1')).toMatchObject({
      location: 'Nuevo',
      notes: 'Legado',
      seriesCount: 25,
      arrowsPerEnd: 13,
    })
  })

  it('saving without changes keeps updatedAt and the stored JSON', async () => {
    seed()
    const before = localStorage.getItem(STORAGE_KEY)
    const { w, router } = await view()
    await submit(w)
    expect(useSessionsStore().getSession('s1')!.updatedAt).toBe(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(router.currentRoute.value.name).toBe('summary')
  })

  it('a closed session saves and stays closed', async () => {
    seedWithArrow({ closed: true })
    const { w } = await view()
    await w.get('#es-notes').setValue('Final')
    await submit(w)
    const s = useSessionsStore().getSession('s1')!
    expect(s.notes).toBe('Final')
    expect(s.closed).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions[0].closed).toBe(true)
  })

  it('a double submit saves once and navigates once', async () => {
    seed()
    const { w, router } = await view('s1', true)
    const store = useSessionsStore()
    const update = vi.spyOn(store, 'updateSession')
    const back = vi.spyOn(router, 'back')
    await w.get('#es-location').setValue('Otro')
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
  })
})

describe('EditSessionView cancel', () => {
  it('after editing fields, «Cancelar» changes nothing and returns to the summary', async () => {
    seed()
    const before = localStorage.getItem(STORAGE_KEY)
    const { w, router } = await view('s1', true)
    await w.get('#es-location').setValue('Cambiado')
    await w.get('#es-arrows').setValue('6')
    await w.get('button.secondary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(SUMMARY_WITH_ARCHER)
    expect(useSessionsStore().getSession('s1')).toMatchObject({ location: 'Club', arrowsPerEnd: 3 })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('on a direct visit, «Cancelar» replaces with the summary', async () => {
    seed()
    const { w, router } = await view()
    await w.get('button.secondary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/session/s1/summary')
  })
})

describe('EditSessionView delete (CU-12)', () => {
  const MESSAGE =
    'Se eliminarán la sesión del 17/10/2026 y todas sus flechas. No se puede deshacer.'
  const mounted: VueWrapper[] = []

  afterEach(() => {
    useConfirm().settle(false)
    while (mounted.length) mounted.pop()!.unmount()
  })

  /** The edit screen plus the dialog host, as App.vue mounts them, attached for focus checks. */
  async function viewWithDialog(id = 's1', fromSummary = false) {
    const router = await editRouter(id, fromSummary)
    const Host = defineComponent(() => () => [h(EditSessionView, { id }), h(ConfirmDialog)])
    const w = mount(Host, { global: { plugins: [router] }, attachTo: document.body })
    mounted.push(w)
    await flushPromises()
    const store = useSessionsStore()
    return { w, router, store }
  }

  function seedTwo(overrides: Partial<Session> = {}) {
    const other = makeSession({ id: 'other', date: '2026-10-01' })
    const target = makeSession({ date: '2026-10-17', ...overrides })
    target.archers[0]!.ends[0] = ['X', '9', null]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([other, target])))
    return { other, target }
  }

  const deleteButton = (w: VueWrapper) => w.get<HTMLButtonElement>('[data-testid="delete-session"]')
  const dialog = (w: VueWrapper) => w.find('[role="dialog"]')

  async function openDialog(w: VueWrapper) {
    await deleteButton(w).trigger('click')
    await flushPromises()
    expect(dialog(w).exists()).toBe(true)
  }

  it.each([
    ['an open', false],
    ['a closed', true],
  ])('%s session shows «Borrar sesión», type="button", outside the form', async (_, closed) => {
    seedWithArrow({ closed })
    const { w } = await view()
    const button = deleteButton(w)
    expect(button.text()).toBe('Borrar sesión')
    expect(button.attributes('type')).toBe('button')
    expect(button.element.disabled).toBe(false)
    expect(button.classes()).not.toContain('secondary')
    expect(button.element.closest('form')).toBeNull()
    expect(button.element.closest('.edit-session')).not.toBeNull()
    const zone = button.element.closest('section.danger-zone')!
    expect(zone.getAttribute('aria-label')).toBe('Borrar sesión')
    // After the form: its own section at the end of the screen.
    const form = w.get('form').element
    expect(form.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The form's own buttons are unchanged.
    expect(save(w).text()).toBe('Guardar cambios')
    expect(w.get('button.secondary').text()).toBe('Cancelar')
  })

  it('an unknown session has no delete button', async () => {
    seed()
    const { w } = await view('nope')
    expect(w.find('[data-testid="delete-session"]').exists()).toBe(false)
  })

  it('opens the app dialog with the exact danger texts, never window.confirm', async () => {
    seedTwo()
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { w } = await viewWithDialog()
    await openDialog(w)
    expect(w.get('#confirm-dialog-title').text()).toBe('¿Borrar la sesión?')
    expect(w.get('#confirm-dialog-message').text()).toBe(MESSAGE)
    expect(w.get('[data-testid="confirm-cancel"]').text()).toBe('Cancelar')
    const accept = w.get('[data-testid="confirm-accept"]')
    expect(accept.text()).toBe('Borrar')
    expect(accept.classes()).not.toContain('is-safe')
    expect(nativeConfirm).not.toHaveBeenCalled()
  })

  it('the message uses the stored date, not an unsaved edit of the date field', async () => {
    seedTwo()
    const { w } = await viewWithDialog()
    await w.get('#es-date').setValue('2027-01-02')
    await openDialog(w)
    expect(w.get('#confirm-dialog-message').text()).toBe(MESSAGE)
  })

  it.each([
    ['«Cancelar»', (w: VueWrapper) => w.get('[data-testid="confirm-cancel"]').trigger('click')],
    [
      'Escape',
      () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      },
    ],
  ])('%s changes nothing, stays on the edit screen and refocuses the button', async (_, close) => {
    seedTwo()
    const before = localStorage.getItem(STORAGE_KEY)
    const { w, router, store } = await viewWithDialog()
    const remove = vi.spyOn(store, 'deleteSession')
    const replace = vi.spyOn(router, 'replace')
    await openDialog(w)
    await close(w)
    await flushPromises()
    await nextTick()
    expect(dialog(w).exists()).toBe(false)
    expect(remove).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(store.sessions).toHaveLength(2)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(router.currentRoute.value.name).toBe('edit-session')
    expect(document.activeElement).toBe(deleteButton(w).element)
    expect(w.text()).not.toContain('No se encontró la sesión.')
  })

  it('«Borrar» replaces with home first, then deletes the session and persists it', async () => {
    const { other } = seedTwo()
    const { w, router, store } = await viewWithDialog('s1', true)
    const remove = vi.spyOn(store, 'deleteSession')
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')
    const back = vi.spyOn(router, 'back')
    const update = vi.spyOn(store, 'updateSession')
    // Navigate-then-delete: when the route changes, the session must still exist.
    const existedOnNavigation: boolean[] = []
    router.afterEach((to) => {
      if (to.name === 'sessions') existedOnNavigation.push(store.getSession('s1') !== undefined)
    })
    await openDialog(w)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(existedOnNavigation).toEqual([true])
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ name: 'sessions', state: { sessionDeleted: true } })
    expect(push).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(router.options.history.state.sessionDeleted).toBe(true)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('s1')
    expect(update).not.toHaveBeenCalled()
    expect(store.getSession('s1')).toBeUndefined()
    expect(store.sessions).toEqual([other])
    await nextTick()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions).toEqual([other])
    expect(dialog(w).exists()).toBe(false)
  })

  it('replace leaves the edit entry out of the history: Back skips it', async () => {
    seedTwo()
    const { w, router } = await viewWithDialog('s1', true)
    await openDialog(w)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    router.back()
    await flushPromises()
    // [/, summary, /]: Back lands on the stale summary, never on the edit form.
    expect(router.currentRoute.value.fullPath).toBe(SUMMARY_WITH_ARCHER)
  })

  it('unsaved and invalid form changes are discarded, not saved, and still delete', async () => {
    seedTwo()
    const { w, store } = await viewWithDialog()
    const update = vi.spyOn(store, 'updateSession')
    await w.get('#es-location').setValue('No guardar')
    await w.get('#es-date').setValue('')
    expect(save(w).element.disabled).toBe(true)
    await openDialog(w)
    expect(w.get('#confirm-dialog-message').text()).toBe(MESSAGE)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(update).not.toHaveBeenCalled()
    expect(store.getSession('s1')).toBeUndefined()
    expect(store.getSession('other')).toMatchObject({ location: 'Club' })
  })

  it('a finalized session is deleted too', async () => {
    seedTwo({ closed: true })
    const { w, store } = await viewWithDialog()
    await openDialog(w)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(store.getSession('s1')).toBeUndefined()
    expect(store.sessions).toHaveLength(1)
  })

  it('a double tap on «Borrar» deletes once and navigates once', async () => {
    seedTwo()
    const { w, router, store } = await viewWithDialog()
    const remove = vi.spyOn(store, 'deleteSession')
    const replace = vi.spyOn(router, 'replace')
    await openDialog(w)
    const accept = w.get<HTMLButtonElement>('[data-testid="confirm-accept"]').element
    accept.click()
    accept.click()
    await flushPromises()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(store.sessions).toHaveLength(1)
  })

  it('while the navigation is pending: button disabled, save, cancel and a second delete ignored', async () => {
    seedTwo()
    const { w, router, store } = await viewWithDialog()
    const update = vi.spyOn(store, 'updateSession')
    const remove = vi.spyOn(store, 'deleteSession')
    const back = vi.spyOn(router, 'back')
    let finish!: () => void
    const replace = vi.spyOn(router, 'replace').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined)
        }),
    )
    await w.get('#es-location').setValue('Otro')
    await openDialog(w)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(deleteButton(w).element.disabled).toBe(true)
    // Still mounted on the form (nothing deleted yet); stray taps do nothing.
    await submit(w)
    await w.get('button.secondary').trigger('click')
    deleteButton(w).element.disabled = false
    await deleteButton(w).trigger('click')
    await flushPromises()
    expect(dialog(w).exists()).toBe(false)
    expect(update).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
    finish()
    await flushPromises()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(store.getSession('s1')).toBeUndefined()
  })

  it('if the navigation fails, the session is still deleted and the not-found screen shows', async () => {
    seedTwo()
    const { w, router, store } = await viewWithDialog()
    vi.spyOn(router, 'replace').mockResolvedValue(undefined)
    await openDialog(w)
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(store.getSession('s1')).toBeUndefined()
    expect(w.text()).toContain('No se encontró la sesión.')
    expect(w.find('form').exists()).toBe(false)
  })
})

describe('EditSessionView not found', () => {
  it('an unknown id shows «No se encontró la sesión.» with a link home and no form', async () => {
    seed()
    const { w } = await view('nope')
    expect(w.text()).toContain('No se encontró la sesión.')
    const link = w.get('a')
    expect(link.text()).toBe('Volver al inicio')
    expect(link.attributes('href')).toBe('/')
    expect(w.find('form').exists()).toBe(false)
  })
})

describe('edit-session route', () => {
  it('is «/session/:id/edit», lazy, with props', () => {
    const route = appRouter.getRoutes().find((r) => r.name === 'edit-session')!
    expect(route.path).toBe('/session/:id/edit')
    expect(typeof route.components!.default).toBe('function')
    expect(route.props.default).toBe(true)
  })
})
