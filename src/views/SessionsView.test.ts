import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { STORAGE_KEY } from '@/composables/usePersistence'
import type { Session } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import SessionsView from './SessionsView.vue'

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

function seed(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState(sessions)))
}

async function view() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'sessions', component: SessionsView },
      { path: '/new', name: 'new-session', component: { template: '<div />' } },
      {
        path: '/session/:id/score/:archerId',
        name: 'scoring',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  const w = mount(SessionsView, { global: { plugins: [router] } })
  return { w, router }
}

function rows(w: Awaited<ReturnType<typeof view>>['w']) {
  return w.findAll('ul[aria-label="Sesiones guardadas"] li a')
}

describe('SessionsView «Nueva sesión»', () => {
  it('has no «Sesión de prueba» button; its only button is «Nueva sesión»', async () => {
    const { w } = await view()
    const buttons = w.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Nueva sesión'])
    expect(buttons[0]!.attributes('type')).toBe('button')
    expect(w.text()).not.toContain('Sesión de prueba')
  })

  it('navigates to /new without creating a session', async () => {
    const { w, router } = await view()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('new-session')
    expect(router.currentRoute.value.path).toBe('/new')
    expect(useSessionsStore().sessions).toHaveLength(0)
  })
})

describe('SessionsView provisional list', () => {
  it('without sessions: the empty text and no list', async () => {
    const { w } = await view()
    expect(w.get('.empty').text()).toBe('Todavía no hay sesiones de entrenamiento.')
    expect(w.find('ul').exists()).toBe(false)
  })

  it('with sessions: no empty text', async () => {
    seed([makeSession()])
    const { w } = await view()
    expect(w.find('.empty').exists()).toBe(false)
    expect(rows(w)).toHaveLength(1)
  })

  it('lists every session newest first: date descending, then createdAt descending', async () => {
    seed([
      makeSession({ id: 'a', date: '2026-01-10', location: 'Enero', createdAt: 9 }),
      makeSession({ id: 'b', date: '2026-10-15', location: 'Temprano', createdAt: 1 }),
      makeSession({ id: 'c', date: '2026-10-15', location: 'Tarde', createdAt: 2 }),
      makeSession({ id: 'd', date: '2025-12-31', location: 'Año pasado', createdAt: 99 }),
    ])
    const { w } = await view()
    expect(rows(w).map((r) => r.text())).toEqual([
      '15/10/2026 · Tarde',
      '15/10/2026 · Temprano',
      '10/01/2026 · Enero',
      '31/12/2025 · Año pasado',
    ])
  })

  it('shows «Sin lugar» for an empty or whitespace-only location, and trims the location', async () => {
    seed([
      makeSession({ id: 'a', location: '', createdAt: 3 }),
      makeSession({ id: 'b', location: '   ', createdAt: 2 }),
      makeSession({ id: 'c', location: '  Club  ', createdAt: 1 }),
    ])
    const { w } = await view()
    expect(rows(w).map((r) => r.text())).toEqual([
      '15/10/2026 · Sin lugar',
      '15/10/2026 · Sin lugar',
      '15/10/2026 · Club',
    ])
  })

  it('tapping a row opens the scoring screen of that session with its first archer', async () => {
    const other = makeSession({ id: 's2', date: '2026-01-01' })
    other.archers[0]!.id = 'a2'
    other.archers.push({ ...other.archers[0]!, id: 'a3', position: 'B' })
    seed([makeSession(), other])
    const { w, router } = await view()
    const link = rows(w)[1]!
    expect(link.attributes('href')).toBe('/session/s2/score/a2')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('scoring')
    expect(router.currentRoute.value.params).toEqual({ id: 's2', archerId: 'a2' })
  })

  it('lists a legacy «Sesión de prueba» session as an ordinary row (no migration)', async () => {
    seed([makeSession({ id: 'legacy', location: 'Sesión de prueba' })])
    const { w } = await view()
    expect(rows(w).map((r) => r.text())).toEqual(['15/10/2026 · Sesión de prueba'])
    expect(rows(w)[0]!.attributes('href')).toBe('/session/legacy/score/a1')
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Nueva sesión'])
  })

  it('a session without archers gets no link (defensive) and does not break the list', async () => {
    seed([makeSession({ id: 'ok', createdAt: 2 })])
    const store = useSessionsStore()
    store.sessions.push({ ...makeSession({ id: 'empty', createdAt: 1 }), archers: [] })
    const { w } = await view()
    expect(w.findAll('ul li')).toHaveLength(2)
    expect(rows(w)).toHaveLength(1)
    expect(rows(w)[0]!.attributes('href')).toBe('/session/ok/score/a1')
  })

  it('updates when a session is created', async () => {
    const { w } = await view()
    useSessionsStore().createSession({
      date: '2026-10-17',
      location: '',
      distance: 18,
      faceId: 'wa-40',
      seriesCount: 2,
      endsPerSeries: 10,
      arrowsPerEnd: 3,
    })
    await flushPromises()
    expect(rows(w).map((r) => r.text())).toEqual(['17/10/2026 · Sin lugar'])
    expect(w.find('.empty').exists()).toBe(false)
  })
})
