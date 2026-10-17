import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStats } from '@/composables/useSessionStats'
import { STORAGE_KEY } from '@/composables/usePersistence'
import type { Session } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'
import { makeSession, makeState } from '../../tests/fixtures'
import SessionCard from './SessionCard.vue'

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

/** Seeds storage and mounts the card with the store's copy of the session (as the list does). */
async function card(overrides: Partial<Session> = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeState([makeSession(overrides)])))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'sessions', component: { template: '<div />' } },
      {
        path: '/session/:id/score/:archerId',
        name: 'scoring',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  const session = useSessionsStore().sessions[0]!
  const w = mount(SessionCard, { props: { session }, global: { plugins: [router] } })
  return { w, router, session }
}

/** `ends` for a session: the given first end, then empty ends. */
function ends(first: (string | null)[], rows: number, arrows: number) {
  return [
    first,
    ...Array.from({ length: rows - 1 }, () => Array.from({ length: arrows }, () => null)),
  ]
}

function withEnds(session: Session, endsMatrix: (string | null)[][]): Partial<Session> {
  return { archers: [{ ...session.archers[0]!, ends: endsMatrix }] }
}

const text = (w: Awaited<ReturnType<typeof card>>['w'], id: string) =>
  w.get(`[data-testid="${id}"]`).text()

describe('SessionCard labels', () => {
  it('shows the date as DD/MM/YYYY and the place', async () => {
    const { w } = await card({ date: '2026-10-17', location: 'Club' })
    expect(w.get('[data-testid="card-date-place"]').element.textContent).toBe('17/10/2026 · Club')
    expect(w.get('.card-date').text()).toBe('17/10/2026')
    expect(w.get('.card-place').text()).toBe('Club')
  })

  it.each([
    ['', 'Sin lugar'],
    ['   ', 'Sin lugar'],
    ['  Club  ', 'Club'],
  ])('location %j shows as «%s»', async (location, shown) => {
    const { w } = await card({ location })
    expect(w.get('[data-testid="card-date-place"]').element.textContent).toBe(
      `15/10/2026 · ${shown}`,
    )
  })

  it('shows «18 m · WA 40 cm» and the structure «2×10×3»', async () => {
    const { w } = await card()
    expect(text(w, 'card-distance-face')).toBe('18 m · WA 40 cm')
    expect(text(w, 'card-structure')).toBe('2×10×3')
    expect(text(w, 'card-structure')).toContain('×')
  })

  it('distance 0 shows «Variable» with the Spanish face name', async () => {
    const { w } = await card({ distance: 0, faceId: 'wa-80-6' })
    expect(text(w, 'card-distance-face')).toBe('Variable · WA 80 cm reducida (6 anillos)')
    expect(w.get('svg').attributes('data-icon')).toBe('wa-reduced')
  })

  it.each([
    ['wa-122', 'WA 122 cm', 'wa-full'],
    ['wa-40-triple', 'WA 40 cm triple', 'wa-triple-vertical'],
    ['wa-field', 'WA Campo', 'wa-field'],
    ['3d', '3D', '3d'],
  ])('%s: name «%s» and the %s icon', async (faceId, name, iconName) => {
    const { w } = await card({ faceId })
    expect(text(w, 'card-distance-face')).toBe(`18 m · ${name}`)
    expect(w.get('svg.card-icon').attributes('data-icon')).toBe(iconName)
  })
})

describe('SessionCard totals', () => {
  it('WA 40 X,9,M: «Total 19/600» and «Promedio 6.33»', async () => {
    const s = makeSession()
    const { w } = await card(withEnds(s, ends(['X', '9', 'M'], 20, 3)))
    expect(w.get('.card-total').text()).toBe('Total 19/600')
    expect(w.get('.card-average').text()).toBe('Promedio 6.33')
  })

  it('field 2×12×3 X,6: X is worth 6, «Total 12/432»', async () => {
    const s = makeSession({ faceId: 'wa-field', distance: 0, endsPerSeries: 12 })
    const { w } = await card({
      faceId: 'wa-field',
      distance: 0,
      endsPerSeries: 12,
      ...withEnds(s, ends(['X', '6', null], 24, 3)),
    })
    expect(w.get('.card-total').text()).toBe('Total 12/432')
    expect(w.get('.card-average').text()).toBe('Promedio 6.00')
  })

  it('3D 2×12×2 11,5: max 11 per arrow, «Total 16/528»', async () => {
    const s = makeSession({ faceId: '3d', endsPerSeries: 12, arrowsPerEnd: 2 })
    const { w } = await card({
      faceId: '3d',
      endsPerSeries: 12,
      arrowsPerEnd: 2,
      ...withEnds(s, ends(['11', '5'], 24, 2)),
    })
    expect(w.get('.card-total').text()).toBe('Total 16/528')
    expect(w.get('.card-average').text()).toBe('Promedio 8.00')
  })

  it('no arrows: «Total 0/600» and «Promedio —»', async () => {
    const { w } = await card()
    expect(w.get('.card-total').text()).toBe('Total 0/600')
    expect(w.get('.card-average').text()).toBe('Promedio —')
  })

  it('only misses: «Promedio 0.00», not «—»', async () => {
    const s = makeSession()
    const { w } = await card(withEnds(s, ends(['M', 'M', 'M'], 20, 3)))
    expect(w.get('.card-total').text()).toBe('Total 0/600')
    expect(w.get('.card-average').text()).toBe('Promedio 0.00')
  })

  it('matches useSessionStats (the scoring screen source) exactly', async () => {
    const s = makeSession()
    const { w } = await card(withEnds(s, ends(['10', '8', '7'], 20, 3)))
    const stats = useSessionStats('s1', 'a1')
    expect(w.get('.card-total').text()).toBe(
      `Total ${stats.grandTotal.value}/${stats.grandMax.value}`,
    )
    expect(stats.averageLabel.value).toBe('Promedio: 8.33')
    expect(w.get('.card-average').text()).toBe('Promedio 8.33')
  })

  it('rendering persists nothing: storage and the session are left as they were', async () => {
    const before = JSON.stringify(makeState([makeSession()]))
    const { session } = await card()
    await flushPromises()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(Object.keys(session).sort()).toEqual(Object.keys(makeSession()).sort())
  })

  it('updates live when the store scores an arrow', async () => {
    const { w } = await card()
    useSessionsStore().getArcher('s1', 'a1')!.ends[0]![0] = 'X'
    await flushPromises()
    expect(w.get('.card-total').text()).toBe('Total 10/600')
    expect(w.get('.card-average').text()).toBe('Promedio 10.00')
  })
})

describe('SessionCard link', () => {
  it('is a single link to the scoring screen of the first archer', async () => {
    const s = makeSession({ id: 's2' })
    s.archers[0]!.id = 'a7'
    s.archers.push({ ...s.archers[0]!, id: 'a8', position: 'B' })
    const { w, router } = await card({ id: 's2', archers: s.archers })
    const links = w.findAll('a')
    expect(links).toHaveLength(1)
    expect(w.element.tagName).toBe('A')
    expect(links[0]!.classes()).toContain('session-card')
    expect(links[0]!.attributes('href')).toBe('/session/s2/score/a7')
    await links[0]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('scoring')
    expect(router.currentRoute.value.params).toEqual({ id: 's2', archerId: 'a7' })
  })

  it('has an accessible name summarising the session', async () => {
    const s = makeSession()
    const { w } = await card({
      date: '2026-10-17',
      ...withEnds(s, ends(['X', '9', 'M'], 20, 3)),
    })
    const label = w.get('a').attributes('aria-label')!
    expect(label.startsWith('17/10/2026, Club, 18 m, WA 40 cm')).toBe(true)
    expect(label).toBe('17/10/2026, Club, 18 m, WA 40 cm, 2×10×3, Total 19/600, Promedio 6.33')
  })

  it('accessible name with «Sin lugar», «Variable» and «—»', async () => {
    const { w } = await card({ location: ' ', distance: 0, faceId: '3d' })
    expect(w.get('a').attributes('aria-label')).toBe(
      '15/10/2026, Sin lugar, Variable, 3D, 2×10×3, Total 0/660, Promedio —',
    )
  })

  it('has no nested controls', async () => {
    const { w } = await card()
    expect(w.findAll('button, input, select, textarea, [tabindex]')).toHaveLength(0)
    expect(w.findAll('a')).toHaveLength(1)
  })

  it('the icon is decorative', async () => {
    const { w } = await card()
    const svg = w.get('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(svg.classes()).toContain('card-icon')
  })

  it('an unknown faceId does not throw: placeholder icon, faceId as name, zero totals', async () => {
    const { w } = await card({ faceId: 'gone' })
    expect(w.find('svg').exists()).toBe(false)
    const placeholder = w.get('span.card-icon')
    expect(placeholder.attributes('aria-hidden')).toBe('true')
    expect(text(w, 'card-distance-face')).toBe('18 m · gone')
    expect(w.get('.card-total').text()).toBe('Total 0/0')
    expect(w.get('.card-average').text()).toBe('Promedio —')
    expect(w.get('a').attributes('href')).toBe('/session/s1/score/a1')
  })
})
