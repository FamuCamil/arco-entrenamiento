import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

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
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
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
  const w = mount(EditSessionView, {
    props: { id },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { w, router }
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
