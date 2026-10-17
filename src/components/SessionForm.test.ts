import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  STRUCTURE_LOCKED_MESSAGE,
  type SessionFormErrors,
  type SessionFormValues,
} from '@/domain/sessionForm'
import { TARGET_FACES } from '@/domain/targetFaces'
import SessionForm from './SessionForm.vue'

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

const VALUES: SessionFormValues = {
  date: '2026-10-17',
  location: 'Club',
  variableDistance: false,
  distance: '18',
  faceId: 'wa-40',
  seriesCount: '2',
  endsPerSeries: '10',
  arrowsPerEnd: '3',
  notes: '',
}

interface Options {
  values?: Partial<SessionFormValues>
  errors?: SessionFormErrors
  structureLocked?: boolean
  cancelTo?: string
  idPrefix?: string
}

async function form(options: Options = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  const values = { ...VALUES, ...options.values }
  const w = mount(SessionForm, {
    props: {
      values,
      'onUpdate:values': (v: SessionFormValues) => w.setProps({ values: v }),
      idPrefix: options.idPrefix ?? 'xx',
      errors: options.errors ?? {},
      structureLocked: options.structureLocked,
      submitLabel: 'Enviar',
      submitDisabled: false,
      cancelTo: options.cancelTo,
    },
    global: { plugins: [router] },
  })
  return { w, values }
}

const LOCKABLE = ['face', 'series', 'ends', 'arrows'] as const

describe('SessionForm ids and labels', () => {
  it('prefixes every control id and labels each one', async () => {
    const { w } = await form({ idPrefix: 'es' })
    const ids = ['date', 'location', 'distance', 'face', 'series', 'ends', 'arrows', 'notes']
    for (const id of ids) {
      expect(w.find(`#es-${id}`).exists(), id).toBe(true)
      expect(w.find(`label[for="es-${id}"]`).exists(), id).toBe(true)
    }
    expect(w.findAll('label[for]')).toHaveLength(8)
    expect(w.get('fieldset legend').text()).toBe('Estructura')
    expect(w.get('button[type="submit"]').text()).toBe('Enviar')
  })

  it('error ids use the prefix and are linked by aria-describedby', async () => {
    const { w } = await form({
      idPrefix: 'es',
      errors: { date: 'Fecha mala', arrowsPerEnd: 'Entre 1 y 12 flechas' },
    })
    expect(w.get('#es-date-error').text()).toBe('Fecha mala')
    expect(w.get('#es-date').attributes('aria-describedby')).toBe('es-date-error')
    expect(w.get('#es-date').attributes('aria-invalid')).toBe('true')
    expect(w.get('#es-arrows').attributes('aria-describedby')).toBe('es-arrowsPerEnd-error')
    expect(w.get('#es-location').attributes('aria-describedby')).toBeUndefined()
  })
})

describe('SessionForm structure lock', () => {
  it('unlocked: no hint; face and structure enabled without aria-describedby', async () => {
    const { w } = await form()
    expect(w.find('[data-testid="structure-locked"]').exists()).toBe(false)
    for (const id of LOCKABLE) {
      const el = w.get(`#xx-${id}`)
      expect(el.attributes('disabled'), id).toBeUndefined()
      expect(el.attributes('aria-describedby'), id).toBeUndefined()
    }
  })

  it('locked: the 4 controls are disabled and described by the hint', async () => {
    const { w } = await form({ structureLocked: true })
    const hint = w.get('[data-testid="structure-locked"]')
    expect(hint.text()).toBe(STRUCTURE_LOCKED_MESSAGE)
    expect(hint.attributes('id')).toBe('xx-structure-locked')
    expect(hint.classes()).toContain('hint')
    for (const id of LOCKABLE) {
      const el = w.get(`#xx-${id}`)
      expect(el.attributes('disabled'), id).toBeDefined()
      expect(el.attributes('aria-describedby'), id).toBe('xx-structure-locked')
    }
    for (const id of ['date', 'location', 'distance', 'notes']) {
      expect(w.get(`#xx-${id}`).attributes('disabled'), id).toBeUndefined()
    }
  })

  it('locked with an error: aria-describedby merges the hint and the error id', async () => {
    const { w } = await form({
      structureLocked: true,
      errors: { faceId: 'Elige una diana', seriesCount: 'Entre 1 y 20 series' },
    })
    expect(w.get('#xx-face').attributes('aria-describedby')).toBe(
      'xx-structure-locked xx-faceId-error',
    )
    expect(w.get('#xx-series').attributes('aria-describedby')).toBe(
      'xx-structure-locked xx-seriesCount-error',
    )
    expect(w.get('#xx-ends').attributes('aria-describedby')).toBe('xx-structure-locked')
  })
})

describe('SessionForm face options', () => {
  it('a catalogue face renders exactly the catalogue', async () => {
    const { w } = await form()
    expect(w.findAll('#xx-face option').map((o) => o.attributes('value'))).toEqual(
      TARGET_FACES.map((f) => f.id),
    )
  })

  it('an unknown face gets a first «Diana desconocida» option, selected', async () => {
    const { w } = await form({ values: { faceId: 'missing-face' } })
    const options = w.findAll('#xx-face option')
    expect(options).toHaveLength(TARGET_FACES.length + 1)
    expect(options[0]!.text()).toBe('Diana desconocida')
    expect(options[0]!.attributes('value')).toBe('missing-face')
    expect(w.get<HTMLSelectElement>('#xx-face').element.value).toBe('missing-face')
  })

  it('an empty faceId adds no extra option', async () => {
    const { w } = await form({ values: { faceId: '' } })
    expect(w.findAll('#xx-face option')).toHaveLength(TARGET_FACES.length)
  })
})

describe('SessionForm events', () => {
  it('submitting emits submit', async () => {
    const { w } = await form()
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('without cancelTo, «Cancelar» is a button that emits cancel', async () => {
    const { w } = await form()
    const cancel = w.get('button.secondary')
    expect(cancel.text()).toBe('Cancelar')
    expect(cancel.attributes('type')).toBe('button')
    expect(w.find('a.secondary').exists()).toBe(false)
    await cancel.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('with cancelTo, «Cancelar» is a link and there is no cancel button', async () => {
    const { w } = await form({ cancelTo: '/' })
    const link = w.get('a.secondary')
    expect(link.text()).toBe('Cancelar')
    expect(link.attributes('href')).toBe('/')
    expect(w.find('button.secondary').exists()).toBe(false)
  })

  it('preset-controlled fields emit preset-edit; date, place and notes do not', async () => {
    const { w } = await form()
    await w.get('#xx-date').setValue('2026-10-18')
    await w.get('#xx-location').setValue('Otro')
    await w.get('#xx-notes').setValue('n')
    expect(w.emitted('preset-edit')).toBeUndefined()
    await w.get('#xx-distance').setValue('25')
    await w.get('#xx-face').setValue('wa-field')
    await w.get('#xx-series').setValue('3')
    await w.get('#xx-ends').setValue('4')
    await w.get('#xx-arrows').setValue('5')
    await w.get('.checkbox input').setValue(true)
    expect(w.emitted('preset-edit')).toHaveLength(6)
  })

  it('checking «Variable» blanks and disables the distance; values flow through v-model', async () => {
    const { w } = await form()
    await w.get('.checkbox input').setValue(true)
    const values = w.props('values') as SessionFormValues
    expect(values.variableDistance).toBe(true)
    expect(values.distance).toBe('')
    expect(w.get('#xx-distance').attributes('disabled')).toBeDefined()
  })
})
