import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { localIsoDate } from '@/domain/dates'
import { useSessionsStore } from '@/stores/sessions'
import SessionsView from './SessionsView.vue'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function view() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'sessions', component: SessionsView },
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

function button(w: Awaited<ReturnType<typeof view>>['w']) {
  return w.get('button')
}

describe('SessionsView «Sesión de prueba»', () => {
  it('creates the test session (today, WA 40, 2×10×3, one archer) and opens its scoring screen', async () => {
    const { w, router } = await view()
    expect(button(w).text()).toBe('Sesión de prueba')
    await button(w).trigger('click')
    await flushPromises()
    const store = useSessionsStore()
    expect(store.sessions).toHaveLength(1)
    const s = store.sessions[0]!
    expect(s).toMatchObject({
      date: localIsoDate(),
      location: 'Sesión de prueba',
      distance: 18,
      faceId: 'wa-40',
      seriesCount: 2,
      endsPerSeries: 10,
      arrowsPerEnd: 3,
      closed: false,
    })
    expect(s.archers).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('scoring')
    expect(router.currentRoute.value.params).toEqual({ id: s.id, archerId: s.archers[0]!.id })
  })

  it('reopens the existing test session instead of creating another', async () => {
    const { w, router } = await view()
    await button(w).trigger('click')
    await flushPromises()
    const first = useSessionsStore().sessions[0]!
    await router.push('/')
    await button(w).trigger('click')
    await flushPromises()
    expect(useSessionsStore().sessions).toHaveLength(1)
    expect(router.currentRoute.value.params.id).toBe(first.id)
  })

  it('does not reuse an ordinary session', async () => {
    const store = useSessionsStore()
    store.createSession({
      date: '2026-01-01',
      location: 'Club',
      distance: 18,
      faceId: 'wa-40',
      seriesCount: 2,
      endsPerSeries: 10,
      arrowsPerEnd: 3,
    })
    const { w } = await view()
    await button(w).trigger('click')
    await flushPromises()
    expect(store.sessions).toHaveLength(2)
  })
})
