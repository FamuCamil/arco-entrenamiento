import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useConfirm } from './useConfirm'

const OPTIONS = { title: '¿Borrar la tanda?', message: 'No se puede deshacer.' }

function button(text: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.textContent = text
  document.body.append(el)
  return el
}

afterEach(() => {
  useConfirm().settle(false)
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useConfirm', () => {
  it('starts with no pending request', () => {
    expect(useConfirm().state.value).toBeNull()
  })

  it('exposes the request with default labels «Aceptar» / «Cancelar»', () => {
    const { confirm, state } = useConfirm()
    void confirm(OPTIONS)
    expect(state.value).toEqual({
      title: '¿Borrar la tanda?',
      message: 'No se puede deshacer.',
      confirmLabel: 'Aceptar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
  })

  it('danger defaults to true and danger: false passes through (CU-10)', () => {
    const { confirm, state } = useConfirm()
    void confirm({ ...OPTIONS, danger: false })
    expect(state.value?.danger).toBe(false)
    void confirm({ ...OPTIONS, danger: true })
    expect(state.value?.danger).toBe(true)
    void confirm(OPTIONS)
    expect(state.value?.danger).toBe(true)
  })

  it('uses the given confirm and cancel labels', () => {
    const { confirm, state } = useConfirm()
    void confirm({ ...OPTIONS, confirmLabel: 'Borrar', cancelLabel: 'Volver' })
    expect(state.value).toMatchObject({ confirmLabel: 'Borrar', cancelLabel: 'Volver' })
  })

  it.each([true, false])('resolves %s via settle and clears the state', async (result) => {
    const { confirm, state, settle } = useConfirm()
    const answer = confirm(OPTIONS)
    settle(result)
    await expect(answer).resolves.toBe(result)
    expect(state.value).toBeNull()
  })

  it('shares one state across useConfirm() calls (singleton)', async () => {
    const answer = useConfirm().confirm(OPTIONS)
    expect(useConfirm().state.value?.title).toBe('¿Borrar la tanda?')
    useConfirm().settle(true)
    await expect(answer).resolves.toBe(true)
  })

  it('a second confirm resolves the first with false and replaces the request', async () => {
    const { confirm, state, settle } = useConfirm()
    const first = confirm(OPTIONS)
    const second = confirm({
      title: '¿Eliminar la sesión?',
      message: 'm',
      confirmLabel: 'Eliminar',
    })
    await expect(first).resolves.toBe(false)
    expect(state.value).toMatchObject({ title: '¿Eliminar la sesión?', confirmLabel: 'Eliminar' })
    settle(true)
    await expect(second).resolves.toBe(true)
  })

  it('settle without a pending request is harmless', () => {
    expect(() => useConfirm().settle(true)).not.toThrow()
    expect(useConfirm().state.value).toBeNull()
  })

  it('never calls window.confirm', async () => {
    const native = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { confirm, settle } = useConfirm()
    const answer = confirm(OPTIONS)
    settle(false)
    await expect(answer).resolves.toBe(false)
    expect(native).not.toHaveBeenCalled()
  })

  it('returns focus to the element focused when confirm() was called', async () => {
    const opener = button('Borrar tanda')
    const other = button('otro')
    opener.focus()
    const { confirm, settle } = useConfirm()
    void confirm(OPTIONS)
    other.focus()
    settle(false)
    expect(document.activeElement).toBe(other)
    await nextTick()
    expect(document.activeElement).toBe(opener)
  })

  it('prefers returnFocusTo over the focused element', async () => {
    const focused = button('a')
    const target = button('b')
    focused.focus()
    const { confirm, settle } = useConfirm()
    void confirm({ ...OPTIONS, returnFocusTo: target })
    settle(true)
    await nextTick()
    expect(document.activeElement).toBe(target)
  })

  it('does not refocus an element that was removed from the document', async () => {
    const opener = button('Borrar tanda')
    const focus = vi.spyOn(opener, 'focus')
    const { confirm, settle } = useConfirm()
    void confirm({ ...OPTIONS, returnFocusTo: opener })
    opener.remove()
    settle(false)
    await nextTick()
    expect(focus).not.toHaveBeenCalled()
  })

  it('does not try to refocus when nothing was focused', async () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    const { confirm, settle } = useConfirm()
    void confirm(OPTIONS)
    settle(false)
    await expect(nextTick()).resolves.toBeUndefined()
    expect(document.activeElement).toBe(document.body)
  })
})
