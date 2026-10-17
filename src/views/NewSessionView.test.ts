import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { localIsoDate } from '@/domain/dates'
import { TARGET_FACES } from '@/domain/targetFaces'
import { SESSION_TEMPLATES } from '@/domain/templates'
import { useSessionsStore } from '@/stores/sessions'
import NewSessionView from './NewSessionView.vue'

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

async function view() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'sessions', component: { template: '<div />' } },
      { path: '/new', name: 'new-session', component: NewSessionView },
      {
        path: '/session/:id/score/:archerId',
        name: 'scoring',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/new')
  const w = mount(NewSessionView, { global: { plugins: [router] } })
  return { w, router }
}

type W = VueWrapper

function templateButtons(w: W) {
  return w.get('[role="group"][aria-label="Plantillas"]').findAll('button')
}

function templateButton(w: W, label: string) {
  const b = templateButtons(w).find((t) => t.text() === label)
  if (!b) throw new Error(`no template button ${label}`)
  return b
}

function pressed(w: W): string[] {
  return templateButtons(w)
    .filter((b) => b.attributes('aria-pressed') === 'true')
    .map((b) => b.text())
}

function input(w: W, id: string) {
  return w.get<HTMLInputElement>(`#${id}`)
}

function value(w: W, id: string): string {
  return input(w, id).element.value
}

function variable(w: W) {
  return w.get<HTMLInputElement>('.checkbox input[type="checkbox"]')
}

function create(w: W) {
  return w.get<HTMLButtonElement>('button[type="submit"]')
}

function structure(w: W) {
  return {
    distance: value(w, 'ns-distance'),
    variable: variable(w).element.checked,
    face: w.get<HTMLSelectElement>('#ns-face').element.value,
    series: value(w, 'ns-series'),
    ends: value(w, 'ns-ends'),
    arrows: value(w, 'ns-arrows'),
  }
}

describe('NewSessionView templates', () => {
  it('shows every SESSION_TEMPLATES entry as a button, including «Personalizada»', async () => {
    const { w } = await view()
    expect(w.get('h2').text()).toBe('Nueva sesión')
    const buttons = templateButtons(w)
    expect(buttons.map((b) => b.text())).toEqual(SESSION_TEMPLATES.map((t) => t.label))
    expect(buttons).toHaveLength(9)
    expect(buttons.at(-1)!.text()).toBe('Personalizada')
    for (const b of buttons) {
      expect(b.attributes('type')).toBe('button')
      expect(['true', 'false']).toContain(b.attributes('aria-pressed'))
    }
  })

  it('starts on «Sala 18 m» pressed with 18 m, WA 40, 2 × 10 × 3; today; empty location and notes', async () => {
    const { w } = await view()
    expect(pressed(w)).toEqual(['Sala 18 m'])
    expect(structure(w)).toEqual({
      distance: '18',
      variable: false,
      face: 'wa-40',
      series: '2',
      ends: '10',
      arrows: '3',
    })
    expect(value(w, 'ns-date')).toBe(localIsoDate())
    expect(value(w, 'ns-location')).toBe('')
    expect(w.get<HTMLTextAreaElement>('#ns-notes').element.value).toBe('')
    expect(create(w).element.disabled).toBe(false)
  })

  it('a preset template overwrites distance, face and structure, keeping typed date, location and notes', async () => {
    const { w } = await view()
    await input(w, 'ns-date').setValue('2026-03-01')
    await input(w, 'ns-location').setValue('Polideportivo')
    await w.get('#ns-notes').setValue('Viento')
    await templateButton(w, 'Aire libre 70 m').trigger('click')
    expect(pressed(w)).toEqual(['Aire libre 70 m'])
    expect(structure(w)).toEqual({
      distance: '70',
      variable: false,
      face: 'wa-122',
      series: '2',
      ends: '6',
      arrows: '6',
    })
    expect(value(w, 'ns-date')).toBe('2026-03-01')
    expect(value(w, 'ns-location')).toBe('Polideportivo')
    expect(w.get<HTMLTextAreaElement>('#ns-notes').element.value).toBe('Viento')
  })

  it('«Campo» checks «Variable», blanks and disables the distance', async () => {
    const { w } = await view()
    await templateButton(w, 'Campo').trigger('click')
    expect(structure(w)).toEqual({
      distance: '',
      variable: true,
      face: 'wa-field',
      series: '2',
      ends: '12',
      arrows: '3',
    })
    expect(input(w, 'ns-distance').element.disabled).toBe(true)
    expect(create(w).element.disabled).toBe(false)
  })

  it('«Personalizada» keeps the current values and leaves every field editable', async () => {
    const { w } = await view()
    await templateButton(w, '3D').trigger('click')
    const before = structure(w)
    await templateButton(w, 'Personalizada').trigger('click')
    expect(pressed(w)).toEqual(['Personalizada'])
    expect(structure(w)).toEqual(before)
    for (const id of ['ns-date', 'ns-location', 'ns-face', 'ns-series', 'ns-ends', 'ns-arrows']) {
      expect(w.get<HTMLInputElement>(`#${id}`).element.disabled, id).toBe(false)
    }
    await variable(w).setValue(false)
    expect(input(w, 'ns-distance').element.disabled).toBe(false)
  })

  it('editing a structure field after a template keeps the edit and presses «Personalizada»', async () => {
    const { w } = await view()
    await templateButton(w, 'Aire libre 30 m').trigger('click')
    await input(w, 'ns-arrows').setValue('4')
    await flushPromises()
    expect(pressed(w)).toEqual(['Personalizada'])
    expect(structure(w)).toMatchObject({ distance: '30', face: 'wa-80', arrows: '4' })
  })

  it('editing the face, the distance or «Variable» also switches to «Personalizada»', async () => {
    const { w } = await view()
    await w.get('#ns-face').setValue('wa-60')
    expect(pressed(w)).toEqual(['Personalizada'])
    expect(structure(w).face).toBe('wa-60')

    await templateButton(w, 'Sala 18 m').trigger('click')
    await input(w, 'ns-distance').setValue('20')
    expect(pressed(w)).toEqual(['Personalizada'])
    expect(structure(w).distance).toBe('20')

    await templateButton(w, 'Sala 18 m').trigger('click')
    await variable(w).setValue(true)
    expect(pressed(w)).toEqual(['Personalizada'])
    expect(structure(w)).toMatchObject({ variable: true, distance: '' })
  })

  it('editing date, location or notes keeps the pressed template', async () => {
    const { w } = await view()
    await input(w, 'ns-date').setValue('2026-01-02')
    await input(w, 'ns-location').setValue('Club')
    await w.get('#ns-notes').setValue('Nota')
    expect(pressed(w)).toEqual(['Sala 18 m'])
  })

  it('a template is only re-applied by tapping it again', async () => {
    const { w } = await view()
    await input(w, 'ns-series').setValue('5')
    await flushPromises()
    expect(structure(w).series).toBe('5')
    await templateButton(w, 'Sala 18 m').trigger('click')
    expect(pressed(w)).toEqual(['Sala 18 m'])
    expect(structure(w).series).toBe('2')
  })
})

describe('NewSessionView form', () => {
  it('every control has a visible label bound with for/id', async () => {
    const { w } = await view()
    const labels = Object.fromEntries(
      w.findAll('label[for]').map((l) => [l.attributes('for'), l.text()]),
    )
    expect(labels).toEqual({
      'ns-date': 'Fecha',
      'ns-location': 'Lugar (opcional)',
      'ns-distance': 'Distancia (m)',
      'ns-face': 'Diana',
      'ns-series': 'Series',
      'ns-ends': 'Tandas por serie',
      'ns-arrows': 'Flechas por tanda',
      'ns-notes': 'Notas (opcional)',
    })
    expect(w.get('.checkbox').text()).toBe('Variable')
    expect(w.get('fieldset legend').text()).toBe('Estructura')
  })

  it('uses native controls: date input, select, numeric text inputs, textarea', async () => {
    const { w } = await view()
    expect(input(w, 'ns-date').attributes('type')).toBe('date')
    expect(w.get('#ns-face').element.tagName).toBe('SELECT')
    expect(w.get('#ns-notes').element.tagName).toBe('TEXTAREA')
    for (const id of ['ns-distance', 'ns-series', 'ns-ends', 'ns-arrows']) {
      expect(input(w, id).attributes('type'), id).toBe('text')
      expect(input(w, id).attributes('inputmode'), id).toBe('numeric')
    }
    expect(w.get('form').attributes('novalidate')).toBeDefined()
  })

  it('the face select offers the 8 catalog faces by their Spanish name', async () => {
    const { w } = await view()
    const options = w.get('#ns-face').findAll('option')
    expect(options).toHaveLength(8)
    expect(options.map((o) => [o.attributes('value'), o.text()])).toEqual(
      TARGET_FACES.map((f) => [f.id, f.name]),
    )
  })

  it('13 arrows: «Crear» disabled and «Entre 1 y 12 flechas» linked by aria-describedby; fixing it clears both', async () => {
    const { w } = await view()
    const arrows = input(w, 'ns-arrows')
    expect(arrows.attributes('aria-invalid')).toBeUndefined()
    expect(arrows.attributes('aria-describedby')).toBeUndefined()

    await arrows.setValue('13')
    expect(create(w).element.disabled).toBe(true)
    const message = w.get('#ns-arrowsPerEnd-error')
    expect(message.text()).toBe('Entre 1 y 12 flechas')
    expect(arrows.attributes('aria-invalid')).toBe('true')
    expect(arrows.attributes('aria-describedby')).toBe('ns-arrowsPerEnd-error')

    await arrows.setValue('12')
    expect(create(w).element.disabled).toBe(false)
    expect(w.find('#ns-arrowsPerEnd-error').exists()).toBe(false)
    expect(arrows.attributes('aria-invalid')).toBeUndefined()
    expect(arrows.attributes('aria-describedby')).toBeUndefined()
  })

  it.each([
    ['ns-series', '0', 'ns-seriesCount-error', 'Entre 1 y 20 series'],
    ['ns-series', '21', 'ns-seriesCount-error', 'Entre 1 y 20 series'],
    ['ns-ends', '', 'ns-endsPerSeries-error', 'Entre 1 y 30 tandas por serie'],
    ['ns-ends', '31', 'ns-endsPerSeries-error', 'Entre 1 y 30 tandas por serie'],
    ['ns-arrows', '', 'ns-arrowsPerEnd-error', 'Entre 1 y 12 flechas'],
    ['ns-distance', '', 'ns-distance-error', 'Indica los metros o marca «Variable»'],
    ['ns-distance', '1.5', 'ns-distance-error', 'Indica los metros o marca «Variable»'],
    ['ns-date', '', 'ns-date-error', 'Fecha no válida'],
  ])('%s = %j shows %s «%s» and disables «Crear»', async (id, text, errorId, message) => {
    const { w } = await view()
    await input(w, id).setValue(text)
    expect(w.get(`#${errorId}`).text()).toBe(message)
    expect(input(w, id).attributes('aria-describedby')).toBe(errorId)
    expect(input(w, id).attributes('aria-invalid')).toBe('true')
    expect(create(w).element.disabled).toBe(true)
  })

  it('unchecking «Variable» with an empty distance is an error until a distance is typed', async () => {
    const { w } = await view()
    await templateButton(w, 'Campo').trigger('click')
    await variable(w).setValue(false)
    expect(w.get('#ns-distance-error').text()).toBe('Indica los metros o marca «Variable»')
    expect(create(w).element.disabled).toBe(true)
    await input(w, 'ns-distance').setValue('15')
    expect(w.find('#ns-distance-error').exists()).toBe(false)
    expect(create(w).element.disabled).toBe(false)
  })

  it('a typed distance of 0 is accepted (Variable)', async () => {
    const { w } = await view()
    await input(w, 'ns-distance').setValue('0')
    expect(w.find('#ns-distance-error').exists()).toBe(false)
    expect(create(w).element.disabled).toBe(false)
  })
})

describe('NewSessionView create and cancel', () => {
  it('«Crear» calls createSession once with the trimmed values and opens the new session', async () => {
    const { w, router } = await view()
    const store = useSessionsStore()
    const spy = vi.spyOn(store, 'createSession')
    await templateButton(w, 'Personalizada').trigger('click')
    await input(w, 'ns-date').setValue('2026-10-16')
    await input(w, 'ns-location').setValue('  Club  ')
    await w.get('#ns-face').setValue('wa-field')
    await input(w, 'ns-series').setValue('1')
    await input(w, 'ns-ends').setValue('2')
    await input(w, 'ns-arrows').setValue('12')
    await w.get('#ns-notes').setValue('  Prueba  ')
    await w.get('form').trigger('submit')
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({
      date: '2026-10-16',
      location: 'Club',
      distance: 18,
      faceId: 'wa-field',
      seriesCount: 1,
      endsPerSeries: 2,
      arrowsPerEnd: 12,
      notes: 'Prueba',
    })
    expect(store.sessions).toHaveLength(1)
    const session = store.sessions[0]!
    expect(session.archers[0]!.ends).toHaveLength(2)
    expect(session.archers[0]!.ends[0]).toHaveLength(12)
    expect(router.currentRoute.value.name).toBe('scoring')
    expect(router.currentRoute.value.params).toEqual({
      id: session.id,
      archerId: session.archers[0]!.id,
    })
  })

  it('creates the default Sala 18 m session as-is', async () => {
    const { w } = await view()
    await w.get('form').trigger('submit')
    await flushPromises()
    const store = useSessionsStore()
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0]).toMatchObject({
      date: localIsoDate(),
      location: '',
      distance: 18,
      faceId: 'wa-40',
      seriesCount: 2,
      endsPerSeries: 10,
      arrowsPerEnd: 3,
      notes: '',
    })
  })

  it('replaces the /new entry, so Back from scoring does not return to the form', async () => {
    const { w, router } = await view()
    const replace = vi.spyOn(router, 'replace')
    const push = vi.spyOn(router, 'push')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('a double submit still creates a single session; «Crear» is then disabled', async () => {
    const { w } = await view()
    const store = useSessionsStore()
    const spy = vi.spyOn(store, 'createSession')
    const form = w.get('form')
    await form.trigger('submit')
    await form.trigger('submit')
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.sessions).toHaveLength(1)
    expect(create(w).element.disabled).toBe(true)
  })

  it('an invalid form does not create anything on submit', async () => {
    const { w, router } = await view()
    const store = useSessionsStore()
    const spy = vi.spyOn(store, 'createSession')
    await input(w, 'ns-arrows').setValue('13')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
    expect(store.sessions).toHaveLength(0)
    expect(router.currentRoute.value.name).toBe('new-session')
  })

  it('«Cancelar» goes home without creating a session', async () => {
    const { w, router } = await view()
    const cancel = w.get('a.secondary')
    expect(cancel.text()).toBe('Cancelar')
    expect(cancel.attributes('href')).toBe('/')
    await cancel.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(useSessionsStore().sessions).toHaveLength(0)
  })
})
