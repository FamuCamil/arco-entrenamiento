import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { STORAGE_KEY } from '@/composables/usePersistence'
import { IMPORT_EMPTY, IMPORT_ERRORS, IMPORT_NO_CHANGES } from '@/domain/backup'
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

/** Any mounted wrapper: the view alone or the view plus the dialog host. */
type Finder = { findAll: (selector: string) => DOMWrapper<Element>[] }

function cards(w: Finder) {
  return w.findAll('ul[aria-label="Sesiones guardadas"] li a.session-card')
}

function datePlaces(w: Finder) {
  return w
    .findAll('ul[aria-label="Sesiones guardadas"] [data-testid="card-date-place"]')
    .map((el) => el.element.textContent)
}

describe('SessionsView «Nueva sesión»', () => {
  it('has no «Sesión de prueba» button; «Nueva sesión» is the only button above the backup', async () => {
    const { w } = await view()
    const buttons = w.findAll('.new-session')
    expect(buttons.map((b) => b.text())).toEqual(['Nueva sesión'])
    expect(buttons[0]!.attributes('type')).toBe('button')
    expect(w.text()).not.toContain('Sesión de prueba')
  })

  it('navigates to /new without creating a session', async () => {
    const { w, router } = await view()
    await w.get('.new-session').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('new-session')
    expect(router.currentRoute.value.path).toBe('/new')
    expect(useSessionsStore().sessions).toHaveLength(0)
  })

  it('stays above the cards', async () => {
    seed([makeSession({ id: 'a', createdAt: 2 }), makeSession({ id: 'b', createdAt: 1 })])
    const { w } = await view()
    expect(w.findAll('.new-session').map((b) => b.text())).toEqual(['Nueva sesión'])
    const button = w.get('.new-session').element
    const list = w.get('ul').element
    expect(button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('SessionsView session cards', () => {
  it('without sessions: the empty text and no list', async () => {
    const { w } = await view()
    expect(w.get('.empty').text()).toBe('Todavía no hay sesiones de entrenamiento.')
    expect(w.find('ul').exists()).toBe(false)
    expect(w.find('.session-card').exists()).toBe(false)
  })

  it('with sessions: one card per session and no empty text', async () => {
    seed([makeSession()])
    const { w } = await view()
    expect(w.find('.empty').exists()).toBe(false)
    expect(w.findAll('ul li')).toHaveLength(1)
    expect(cards(w)).toHaveLength(1)
    expect(w.get('[data-testid="card-structure"]').text()).toBe('2×10×3')
    expect(w.get('.card-total').text()).toBe('Total 0/600')
  })

  it('orders cards newest first: date descending, then createdAt descending', async () => {
    seed([
      makeSession({ id: 'a', date: '2026-01-10', location: 'Enero', createdAt: 9 }),
      makeSession({ id: 'b', date: '2026-10-15', location: 'Temprano', createdAt: 1 }),
      makeSession({ id: 'c', date: '2026-10-15', location: 'Tarde', createdAt: 2 }),
      makeSession({ id: 'd', date: '2025-12-31', location: 'Año pasado', createdAt: 99 }),
    ])
    const { w } = await view()
    expect(datePlaces(w)).toEqual([
      '15/10/2026 · Tarde',
      '15/10/2026 · Temprano',
      '10/01/2026 · Enero',
      '31/12/2025 · Año pasado',
    ])
    expect(cards(w).map((c) => c.attributes('href'))).toEqual(
      ['c', 'b', 'a', 'd'].map((id) => `/session/${id}/score/a1`),
    )
  })

  it('shows «Sin lugar» for an empty or whitespace-only location, and trims the location', async () => {
    seed([
      makeSession({ id: 'a', location: '', createdAt: 3 }),
      makeSession({ id: 'b', location: '   ', createdAt: 2 }),
      makeSession({ id: 'c', location: '  Club  ', createdAt: 1 }),
    ])
    const { w } = await view()
    expect(datePlaces(w)).toEqual([
      '15/10/2026 · Sin lugar',
      '15/10/2026 · Sin lugar',
      '15/10/2026 · Club',
    ])
  })

  it('tapping a card opens the scoring screen of that session with its first archer', async () => {
    const other = makeSession({ id: 's2', date: '2026-01-01' })
    other.archers[0]!.id = 'a2'
    other.archers.push({ ...other.archers[0]!, id: 'a3', position: 'B' })
    seed([makeSession(), other])
    const { w, router } = await view()
    const link = cards(w)[1]!
    expect(link.attributes('href')).toBe('/session/s2/score/a2')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('scoring')
    expect(router.currentRoute.value.params).toEqual({ id: 's2', archerId: 'a2' })
  })

  it('lists a legacy «Sesión de prueba» session as an ordinary card (no migration)', async () => {
    seed([makeSession({ id: 'legacy', location: 'Sesión de prueba' })])
    const { w } = await view()
    expect(datePlaces(w)).toEqual(['15/10/2026 · Sesión de prueba'])
    expect(cards(w)[0]!.attributes('href')).toBe('/session/legacy/score/a1')
    expect(w.findAll('.new-session').map((b) => b.text())).toEqual(['Nueva sesión'])
  })

  it('omits a session without archers (defensive) without breaking the list', async () => {
    seed([makeSession({ id: 'ok', createdAt: 2 })])
    const store = useSessionsStore()
    store.sessions.push({ ...makeSession({ id: 'empty', createdAt: 1 }), archers: [] })
    const { w } = await view()
    expect(w.findAll('ul li')).toHaveLength(1)
    expect(cards(w)).toHaveLength(1)
    expect(cards(w)[0]!.attributes('href')).toBe('/session/ok/score/a1')
  })

  it('shows the empty text when the only session has no archers', async () => {
    const store = useSessionsStore()
    store.sessions.push({ ...makeSession({ id: 'empty' }), archers: [] })
    const { w } = await view()
    expect(w.find('ul').exists()).toBe(false)
    expect(w.get('.empty').text()).toBe('Todavía no hay sesiones de entrenamiento.')
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
    expect(datePlaces(w)).toEqual(['17/10/2026 · Sin lugar'])
    expect(w.find('.empty').exists()).toBe(false)
  })

  it('no TODO(CU-09) provisional list remains', async () => {
    const source = await import('./SessionsView.vue?raw')
    expect(source.default).not.toContain('TODO(CU-09)')
    expect(source.default).not.toContain('session-link')
  })
})

describe('SessionsView focus after deleting a session (CU-12)', () => {
  /** Lands on home the way EditSessionView does after a delete: a replace with the given state. */
  async function arriveHome(state?: { sessionDeleted: boolean }) {
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'sessions', component: SessionsView },
        { path: '/session/:id/edit', name: 'edit-session', component: stub },
        { path: '/new', name: 'new-session', component: stub },
        { path: '/session/:id/score/:archerId', name: 'scoring', component: stub },
      ],
    })
    await router.push('/session/s1/edit')
    await router.replace({ name: 'sessions', ...(state && { state }) })
    const w = mount(SessionsView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return w
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses the «Sesiones» heading when arriving with sessionDeleted', async () => {
    seed([makeSession({ id: 'other' })])
    const w = await arriveHome({ sessionDeleted: true })
    const heading = w.get('h2')
    expect(heading.text()).toBe('Sesiones')
    expect(heading.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(heading.element)
    expect(cards(w)).toHaveLength(1)
    w.unmount()
  })

  it('after deleting the last session: the empty text, heading focused', async () => {
    const w = await arriveHome({ sessionDeleted: true })
    expect(w.text()).toContain('Todavía no hay sesiones de entrenamiento.')
    expect(document.activeElement).toBe(w.get('h2').element)
    w.unmount()
  })

  it.each([
    ['without state', undefined],
    ['with sessionDeleted false', { sessionDeleted: false }],
  ])('does not move focus on a plain arrival (%s)', async (_, state) => {
    seed([makeSession()])
    const w = await arriveHome(state)
    expect(document.activeElement).not.toBe(w.get('h2').element)
    expect(document.activeElement).toBe(document.body)
    w.unmount()
  })
})

describe('SessionsView «Copia de seguridad» (CU-11)', () => {
  type Wrapper = ReturnType<typeof mount>
  const mounted: Wrapper[] = []
  const NAV_PROPS = ['share', 'canShare'] as const
  const URL_PROPS = ['createObjectURL', 'revokeObjectURL'] as const

  afterEach(() => {
    useConfirm().settle(false)
    while (mounted.length) mounted.pop()!.unmount()
    for (const key of NAV_PROPS) Reflect.deleteProperty(navigator, key)
    for (const key of URL_PROPS) Reflect.deleteProperty(URL, key)
    vi.useRealTimers()
  })

  /** SessionsView plus the dialog host, as App.vue mounts them, attached for focus checks. */
  async function viewWithDialog() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: SessionsView },
        {
          path: '/session/:id/score/:archerId',
          name: 'scoring',
          component: { template: '<div />' },
        },
        { path: '/new', name: 'new-session', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    const Host = defineComponent(() => () => [h(SessionsView), h(ConfirmDialog)])
    const w = mount(Host, { global: { plugins: [router] }, attachTo: document.body })
    mounted.push(w)
    await flushPromises()
    return w
  }

  function stubShare(
    share: (data: ShareData) => Promise<void>,
    canShare: () => boolean = () => true,
  ) {
    const shareSpy = vi.fn(share)
    const canShareSpy = vi.fn(canShare)
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShareSpy, configurable: true })
    return { share: shareSpy, canShare: canShareSpy }
  }

  /** Stubs the object-URL API and the anchor click, recording the clicked links. */
  function stubDownload() {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:backup')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const links: {
      href: string
      download: string
      hidden: HTMLElement['hidden']
      connected: boolean
    }[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      links.push({
        href: this.href,
        download: this.download,
        hidden: this.hidden,
        connected: this.isConnected,
      })
    })
    return { createObjectURL, revokeObjectURL, click, links }
  }

  async function chooseFile(w: Wrapper, file: File | { text: () => Promise<string> } | null) {
    const input = w.get('[data-testid="import-input"]')
    let value = 'C:\\fakepath\\copia.json'
    Object.defineProperty(input.element, 'files', {
      value: file ? [file] : [],
      configurable: true,
    })
    Object.defineProperty(input.element, 'value', {
      get: () => value,
      set: (v: string) => {
        value = v
      },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    return () => value
  }

  function backupFile(sessions: Session[], profileName = '') {
    const json = JSON.stringify({ ...makeState(sessions), profileName, exportedAt: 'x' })
    return new File([json], 'arco-copia-2026-10-17.json', { type: 'application/json' })
  }

  const status = (w: Wrapper) => w.get('[data-testid="backup-status"]')
  const alert = (w: Wrapper) => w.get('[data-testid="backup-alert"]')
  const dialog = (w: Wrapper) => w.find('[role="dialog"]')
  const exportButton = (w: Wrapper) => w.get('[data-testid="export-backup"]')
  const importButton = (w: Wrapper) => w.get('[data-testid="import-backup"]')

  describe('section', () => {
    it('comes after the list, with the heading, both buttons and the live regions', async () => {
      seed([makeSession()])
      const w = await viewWithDialog()
      const section = w.get('[data-testid="backup-section"]')
      expect(section.element.tagName).toBe('SECTION')
      expect(section.attributes('aria-labelledby')).toBe('backup-title')
      expect(section.get('h3#backup-title').text()).toBe('Copia de seguridad')
      const list = w.get('ul[aria-label="Sesiones guardadas"]').element
      expect(
        list.compareDocumentPosition(section.element) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        section
          .findAll('.backup-actions button')
          .map((b) => [b.text(), b.attributes('data-testid'), b.attributes('type')]),
      ).toEqual([
        ['Exportar copia', 'export-backup', 'button'],
        ['Importar copia', 'import-backup', 'button'],
      ])
      for (const b of section.findAll('.backup-actions button')) {
        expect(b.classes()).not.toContain('danger')
      }
      expect(exportButton(w).attributes('aria-disabled')).toBeUndefined()
      expect(status(w).attributes()).toMatchObject({ role: 'status', 'aria-live': 'polite' })
      expect(alert(w).attributes('role')).toBe('alert')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
      const input = w.get('[data-testid="import-input"]')
      expect(input.attributes()).toMatchObject({
        type: 'file',
        accept: 'application/json,.json',
        tabindex: '-1',
        'aria-hidden': 'true',
      })
    })

    it('renders after the empty text too, with both live regions mounted', async () => {
      const w = await viewWithDialog()
      const empty = w.get('.empty').element
      const section = w.get('[data-testid="backup-section"]').element
      expect(empty.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(w.find('[data-testid="backup-status"]').exists()).toBe(true)
      expect(w.find('[data-testid="backup-alert"]').exists()).toBe(true)
      const newSession = w.get('.new-session').element
      expect(
        newSession.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  describe('export', () => {
    it('is aria-disabled with zero sessions, stays focusable, and a click does nothing', async () => {
      const { share } = stubShare(() => Promise.resolve())
      const { createObjectURL, click } = stubDownload()
      const w = await viewWithDialog()
      const button = exportButton(w)
      expect(button.attributes('aria-disabled')).toBe('true')
      expect(button.attributes('disabled')).toBeUndefined()
      await button.trigger('click')
      await flushPromises()
      expect(share).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('enables once a session exists', async () => {
      const w = await viewWithDialog()
      useSessionsStore().sessions.push(makeSession())
      await flushPromises()
      expect(exportButton(w).attributes('aria-disabled')).toBeUndefined()
    })

    it('shares one JSON File with the title when the share sheet supports files; no download', async () => {
      seed([makeSession()])
      const { share, canShare } = stubShare(() => Promise.resolve())
      const { createObjectURL, click } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      // Called synchronously within the click (iOS user gesture).
      expect(share).toHaveBeenCalledTimes(1)
      await flushPromises()
      const data = share.mock.calls[0]![0]
      expect(data.title).toBe('Copia de seguridad de Arco · Entrenamientos')
      expect(data.files).toHaveLength(1)
      const file = data.files![0]!
      expect(file).toBeInstanceOf(File)
      expect(file.name).toMatch(/^arco-copia-\d{4}-\d{2}-\d{2}\.json$/)
      expect(file.type).toBe('application/json')
      const parsed = JSON.parse(await file.text())
      expect(parsed.sessions).toEqual([makeSession()])
      expect(parsed.version).toBe(1)
      expect(canShare).toHaveBeenCalledWith({ files: [file] })
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('a cancelled share sheet (AbortError) shows nothing and does not download', async () => {
      seed([makeSession()])
      // jsdom's DOMException does not inherit from Error (browsers' does), so the browser's
      // AbortError is modelled as an Error named AbortError.
      const abort = Object.assign(new Error('cancel'), { name: 'AbortError' })
      const { share } = stubShare(() => Promise.reject(abort))
      const { createObjectURL, click } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      await flushPromises()
      expect(share).toHaveBeenCalledTimes(1)
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('any other share failure falls back to the download', async () => {
      seed([makeSession()])
      stubShare(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))
      const { links } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      await flushPromises()
      expect(links).toHaveLength(1)
      expect(links[0]!.download).toMatch(/^arco-copia-\d{4}-\d{2}-\d{2}\.json$/)
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('a share failure whose fallback download also fails shows the export error', async () => {
      seed([makeSession()])
      stubShare(() => Promise.reject(new TypeError('boom')))
      stubDownload().createObjectURL.mockImplementation(() => {
        throw new Error('no blob URLs')
      })
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      await flushPromises()
      expect(alert(w).text()).toContain('No se pudo exportar la copia.')
    })

    it('canShare throwing a TypeError counts as unsupported: download, share not called', async () => {
      seed([makeSession()])
      const { share } = stubShare(
        () => Promise.resolve(),
        () => {
          throw new TypeError('files not supported')
        },
      )
      const { links } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      await flushPromises()
      expect(share).not.toHaveBeenCalled()
      expect(links).toHaveLength(1)
    })

    it('canShare returning false: download, share not called', async () => {
      seed([makeSession()])
      const { share } = stubShare(
        () => Promise.resolve(),
        () => false,
      )
      const { links } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      expect(share).not.toHaveBeenCalled()
      expect(links).toHaveLength(1)
    })

    it('without Web Share: downloads through a temporary <a download> and revokes the URL later', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      seed([makeSession()])
      expect('share' in navigator).toBe(false)
      const { createObjectURL, revokeObjectURL, links } = stubDownload()
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0]![0] as File
      expect(blob.name).toMatch(/^arco-copia-\d{4}-\d{2}-\d{2}\.json$/)
      expect(blob.type).toBe('application/json')
      expect(JSON.parse(await blob.text()).sessions).toHaveLength(1)
      expect(links).toEqual([
        { href: 'blob:backup', download: blob.name, hidden: true, connected: true },
      ])
      // The temporary link is removed right away.
      expect(document.querySelector('a[download]')).toBeNull()
      expect(revokeObjectURL).not.toHaveBeenCalled()
      vi.advanceTimersByTime(999)
      expect(revokeObjectURL).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('a download that throws shows «No se pudo exportar la copia.» in the alert region', async () => {
      seed([makeSession()])
      stubDownload().createObjectURL.mockImplementation(() => {
        throw new Error('no blob URLs')
      })
      const w = await viewWithDialog()
      await exportButton(w).trigger('click')
      await flushPromises()
      expect(alert(w).get('[data-testid="backup-notice"]').text()).toContain(
        'No se pudo exportar la copia.',
      )
      expect(alert(w).get('.notice').classes()).toContain('notice-error')
      expect(status(w).find('[data-testid="backup-notice"]').exists()).toBe(false)
    })
  })

  describe('import', () => {
    it('«Importar copia» opens the file picker', async () => {
      const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
      const w = await viewWithDialog()
      await importButton(w).trigger('click')
      expect(click).toHaveBeenCalledTimes(1)
      expect(click.mock.contexts[0]).toBe(w.get('[data-testid="import-input"]').element)
    })

    it('a valid file with changes opens the app dialog with the exact texts, never window.confirm', async () => {
      seed([makeSession({ id: 'a', updatedAt: 1 }), makeSession({ id: 'b', updatedAt: 1 })])
      const nativeConfirm = vi.spyOn(window, 'confirm')
      const w = await viewWithDialog()
      await chooseFile(
        w,
        backupFile([
          makeSession({ id: 'a', updatedAt: 2 }),
          makeSession({ id: 'b', updatedAt: 1 }),
          makeSession({ id: 'c' }),
          makeSession({ id: 'd' }),
        ]),
      )
      const d = dialog(w)
      expect(d.exists()).toBe(true)
      expect(d.get('h2').text()).toBe('¿Importar copia?')
      expect(d.get('p').text()).toBe('Se añadirán 2 sesiones y se actualizará 1. 1 ya está al día.')
      expect(d.findAll('button').map((b) => b.text())).toEqual(['Cancelar', 'Importar'])
      expect(w.get('[data-testid="confirm-accept"]').classes()).toContain('is-safe')
      expect(useConfirm().state.value?.danger).toBe(false)
      expect(nativeConfirm).not.toHaveBeenCalled()
      expect(useSessionsStore().sessions.map((s) => s.updatedAt)).toEqual([1, 1])
    })

    it('«Importar» applies the merge: cards update and the success notice is in the status region', async () => {
      seed([makeSession({ id: 'a', location: 'Viejo', updatedAt: 1 })])
      const w = await viewWithDialog()
      await chooseFile(
        w,
        backupFile([
          makeSession({ id: 'a', location: 'Nuevo', updatedAt: 2 }),
          makeSession({ id: 'b', location: 'Otro', date: '2026-10-16' }),
        ]),
      )
      await w.get('[data-testid="confirm-accept"]').trigger('click')
      await flushPromises()
      expect(dialog(w).exists()).toBe(false)
      expect(datePlaces(w)).toEqual(['16/10/2026 · Otro', '15/10/2026 · Nuevo'])
      const notice = status(w).get('[data-testid="backup-notice"]')
      expect(notice.get('p').text()).toBe(
        'Copia importada: 1 sesión añadida, 1 actualizada y 0 sin cambios.',
      )
      expect(notice.classes()).toContain('notice-success')
      expect(alert(w).find('[data-testid="backup-notice"]').exists()).toBe(false)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions).toHaveLength(2)
    })

    it('«Cancelar» changes nothing and returns focus to «Importar copia»', async () => {
      seed([makeSession({ id: 'a' })])
      const storedBefore = localStorage.getItem(STORAGE_KEY)
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([makeSession({ id: 'b' })]))
      expect(dialog(w).exists()).toBe(true)
      await w.get('[data-testid="confirm-cancel"]').trigger('click')
      await flushPromises()
      expect(dialog(w).exists()).toBe(false)
      expect(cards(w)).toHaveLength(1)
      expect(useSessionsStore().sessions.map((s) => s.id)).toEqual(['a'])
      expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore)
      expect(document.activeElement).toBe(importButton(w).element)
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('Escape changes nothing and returns focus to «Importar copia»', async () => {
      seed([makeSession({ id: 'a' })])
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([makeSession({ id: 'b' })]))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(dialog(w).exists()).toBe(false)
      expect(useSessionsStore().sessions.map((s) => s.id)).toEqual(['a'])
      expect(document.activeElement).toBe(importButton(w).element)
    })

    it('no changes: no dialog, the «al día» info notice in the status region', async () => {
      const s = makeSession({ id: 'a' })
      seed([s])
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([s]))
      expect(dialog(w).exists()).toBe(false)
      const notice = status(w).get('[data-testid="backup-notice"]')
      expect(notice.get('p').text()).toBe(IMPORT_NO_CHANGES)
      expect(notice.classes()).toContain('notice-info')
      expect(cards(w)).toHaveLength(1)
    })

    it('no changes but a blank local name: adopts the file name without a dialog', async () => {
      const s = makeSession({ id: 'a' })
      seed([s])
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([s], 'Ana'))
      expect(dialog(w).exists()).toBe(false)
      expect(useSessionsStore().profileName).toBe('Ana')
      expect(status(w).text()).toContain(IMPORT_NO_CHANGES)
    })

    it('an empty copy: no dialog and «La copia no contiene sesiones.»', async () => {
      seed([makeSession({ id: 'a' })])
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([]))
      expect(dialog(w).exists()).toBe(false)
      expect(status(w).get('[data-testid="backup-notice"] p').text()).toBe(IMPORT_EMPTY)
      expect(cards(w)).toHaveLength(1)
    })

    it.each([
      ['not JSON', 'hola', IMPORT_ERRORS.notJson],
      [
        'damaged sessions',
        JSON.stringify(makeState([{ id: 'x' } as never])),
        IMPORT_ERRORS.invalidSessions,
      ],
      ['a newer version', JSON.stringify({ version: 2, data: [] }), IMPORT_ERRORS.newerVersion],
    ])(
      'an invalid file (%s): exact message in the alert region, nothing changes',
      async (_l, raw, message) => {
        seed([makeSession({ id: 'a' })])
        const storedBefore = localStorage.getItem(STORAGE_KEY)
        const w = await viewWithDialog()
        // Content decides, not the MIME type (some iOS label JSON as text/plain).
        await chooseFile(w, new File([raw], 'copia.json', { type: 'text/plain' }))
        expect(dialog(w).exists()).toBe(false)
        const notice = alert(w).get('[data-testid="backup-notice"]')
        expect(notice.get('p').text()).toBe(message)
        expect(notice.classes()).toContain('notice-error')
        expect(status(w).find('[data-testid="backup-notice"]').exists()).toBe(false)
        expect(useSessionsStore().sessions.map((s) => s.id)).toEqual(['a'])
        expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore)
      },
    )

    it('a valid file labelled text/plain is accepted', async () => {
      const w = await viewWithDialog()
      const json = JSON.stringify(makeState([makeSession({ id: 'z' })]))
      await chooseFile(w, new File([json], 'copia.json', { type: 'text/plain' }))
      expect(dialog(w).exists()).toBe(true)
    })

    it('an unreadable file shows «No se pudo leer el archivo.»', async () => {
      const w = await viewWithDialog()
      await chooseFile(w, { text: () => Promise.reject(new Error('io')) })
      expect(alert(w).get('[data-testid="backup-notice"] p').text()).toBe(
        'No se pudo leer el archivo.',
      )
      expect(dialog(w).exists()).toBe(false)
    })

    it('a storage failure after «Importar» shows the save warning in the alert region', async () => {
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([makeSession({ id: 'a' })]))
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      await w.get('[data-testid="confirm-accept"]').trigger('click')
      await flushPromises()
      expect(alert(w).get('[data-testid="backup-notice"] p').text()).toBe(
        'Las sesiones se han importado, pero no se pudieron guardar en el dispositivo. Podrían perderse al cerrar la app.',
      )
      expect(cards(w)).toHaveLength(1)
    })

    it('a storage failure on a profile-only adoption shows the save warning', async () => {
      const s = makeSession({ id: 'a' })
      seed([s])
      const w = await viewWithDialog()
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      await chooseFile(w, backupFile([s], 'Ana'))
      expect(alert(w).text()).toContain('no se pudieron guardar en el dispositivo')
    })

    it('clears the input value after change, so the same file can be chosen again', async () => {
      const s = makeSession({ id: 'a' })
      seed([s])
      const w = await viewWithDialog()
      const value = await chooseFile(w, backupFile([s]))
      expect(value()).toBe('')
      expect(status(w).text()).toContain(IMPORT_NO_CHANGES)
      await w.get('[data-testid="backup-notice-close"]').trigger('click')
      await chooseFile(w, backupFile([s]))
      expect(status(w).text()).toContain(IMPORT_NO_CHANGES)
    })

    it('no file chosen: nothing happens', async () => {
      const w = await viewWithDialog()
      const value = await chooseFile(w, null)
      expect(value()).toBe('')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
      expect(dialog(w).exists()).toBe(false)
    })
  })

  describe('notices', () => {
    it('the close button removes the notice; it has an accessible name', async () => {
      const w = await viewWithDialog()
      await chooseFile(w, new File(['x'], 'copia.json'))
      const close = alert(w).get('[data-testid="backup-notice-close"]')
      expect(close.attributes('aria-label')).toBe('Cerrar aviso')
      expect(close.attributes('type')).toBe('button')
      await close.trigger('click')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
      expect(w.find('[data-testid="backup-alert"]').exists()).toBe(true)
    })

    it('the next «Importar copia» click clears the notice', async () => {
      vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
      const w = await viewWithDialog()
      await chooseFile(w, new File(['x'], 'copia.json'))
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(true)
      await importButton(w).trigger('click')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('the next «Exportar copia» click clears the notice', async () => {
      seed([makeSession({ id: 'a' })])
      stubDownload()
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([makeSession({ id: 'a' })]))
      expect(status(w).find('[data-testid="backup-notice"]').exists()).toBe(true)
      await exportButton(w).trigger('click')
      expect(w.find('[data-testid="backup-notice"]').exists()).toBe(false)
    })

    it('only one notice at a time: a new error replaces a success', async () => {
      const w = await viewWithDialog()
      await chooseFile(w, backupFile([]))
      expect(status(w).find('[data-testid="backup-notice"]').exists()).toBe(true)
      await chooseFile(w, new File(['x'], 'copia.json'))
      expect(w.findAll('[data-testid="backup-notice"]')).toHaveLength(1)
      expect(alert(w).find('[data-testid="backup-notice"]').exists()).toBe(true)
    })
  })
})
