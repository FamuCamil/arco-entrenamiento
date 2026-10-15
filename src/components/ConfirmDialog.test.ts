import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useConfirm } from '@/composables/useConfirm'
import ConfirmDialog from './ConfirmDialog.vue'

const OPTIONS = {
  title: '¿Borrar la tanda?',
  message: 'Se borrarán todas las flechas de la serie 1, tanda 2. No se puede deshacer.',
  confirmLabel: 'Borrar',
}

let wrapper: VueWrapper | null = null

afterEach(() => {
  useConfirm().settle(false)
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

/** Mounts the dialog host, opens a request and waits for the initial focus. */
async function open(options = OPTIONS) {
  wrapper = mount(ConfirmDialog, { attachTo: document.body })
  const answer = useConfirm().confirm(options)
  await flushPromises()
  return { w: wrapper, answer }
}

function key(name: string, shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }))
}

describe('ConfirmDialog', () => {
  it('renders nothing without a pending request', () => {
    wrapper = mount(ConfirmDialog, { attachTo: document.body })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('is a labelled, described modal dialog with Spanish texts', async () => {
    const { w } = await open()
    const dialog = w.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    const title = w.get(`#${dialog.attributes('aria-labelledby')}`)
    const message = w.get(`#${dialog.attributes('aria-describedby')}`)
    expect(title.element.tagName).toBe('H2')
    expect(title.text()).toBe('¿Borrar la tanda?')
    expect(message.text()).toBe(OPTIONS.message)
    const buttons = dialog.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['Cancelar', 'Borrar'])
    for (const b of buttons) expect(b.attributes('type')).toBe('button')
  })

  it('shows the generic default labels', async () => {
    const { w } = await open({ title: 't', message: 'm' } as typeof OPTIONS)
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Cancelar', 'Aceptar'])
  })

  it('focuses Cancel on open', async () => {
    const { w } = await open()
    expect(document.activeElement).toBe(w.get('[data-testid="confirm-cancel"]').element)
  })

  it('Cancel resolves false and closes', async () => {
    const { w, answer } = await open()
    await w.get('[data-testid="confirm-cancel"]').trigger('click')
    await expect(answer).resolves.toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('Confirm resolves true and closes', async () => {
    const { w, answer } = await open()
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await expect(answer).resolves.toBe(true)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('a backdrop click cancels; a click inside the panel does not', async () => {
    const { w, answer } = await open()
    await w.get('[role="dialog"]').trigger('click')
    await w.get('h2').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    await w.get('[data-testid="confirm-backdrop"]').trigger('click')
    await expect(answer).resolves.toBe(false)
  })

  it('Escape cancels', async () => {
    const { w, answer } = await open()
    key('Escape')
    await expect(answer).resolves.toBe(false)
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('Escape still cancels after focus fell to body (click on panel padding)', async () => {
    const { answer } = await open()
    ;(document.activeElement as HTMLElement).blur()
    expect(document.activeElement).toBe(document.body)
    key('Escape')
    await expect(answer).resolves.toBe(false)
  })

  it('Tab and Shift+Tab wrap between the two buttons', async () => {
    const { w } = await open()
    const cancel = w.get('[data-testid="confirm-cancel"]').element as HTMLButtonElement
    const accept = w.get('[data-testid="confirm-accept"]').element as HTMLButtonElement
    key('Tab', true)
    expect(document.activeElement).toBe(accept)
    key('Tab')
    expect(document.activeElement).toBe(cancel)
    // From the first button forward Tab is left to the browser (no preventDefault).
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    accept.focus()
    const back = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(back)
    expect(back.defaultPrevented).toBe(false)
  })

  it('Tab pulls focus back in when it escaped to body', async () => {
    const { w } = await open()
    ;(document.activeElement as HTMLElement).blur()
    key('Tab')
    expect(document.activeElement).toBe(w.get('[data-testid="confirm-cancel"]').element)
    ;(document.activeElement as HTMLElement).blur()
    key('Tab', true)
    expect(document.activeElement).toBe(w.get('[data-testid="confirm-accept"]').element)
  })

  it('other keys do nothing', async () => {
    const { w } = await open()
    key('Enter')
    key('a')
    expect(w.find('[role="dialog"]').exists()).toBe(true)
  })

  it('adds the keydown listener on open and removes the same one when closed', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const { w } = await open()
    const added = add.mock.calls.find(([type]) => type === 'keydown')
    expect(added).toBeDefined()
    await w.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('keydown', added![1])
  })

  it('removes the keydown listener on unmount', async () => {
    const { w, answer } = await open()
    w.unmount()
    wrapper = null
    key('Escape')
    // With no host listening, the request is still pending.
    expect(useConfirm().state.value).not.toBeNull()
    useConfirm().settle(true)
    await expect(answer).resolves.toBe(true)
  })

  it('returns focus to the opener after closing', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    wrapper = mount(ConfirmDialog, { attachTo: document.body })
    void useConfirm().confirm(OPTIONS)
    await flushPromises()
    expect(document.activeElement).not.toBe(opener)
    key('Escape')
    await flushPromises()
    expect(document.activeElement).toBe(opener)
  })
})
