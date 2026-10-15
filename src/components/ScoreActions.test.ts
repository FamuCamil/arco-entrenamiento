import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ScoreActions from './ScoreActions.vue'

function actions(canDeleteArrow = true, canDeleteEnd = true) {
  return mount(ScoreActions, { props: { canDeleteArrow, canDeleteEnd } })
}

describe('ScoreActions', () => {
  it('is a labelled group of two buttons with Spanish text and aria-labels', () => {
    const w = actions()
    expect(w.get('[role="group"]').attributes('aria-label')).toBe('Acciones de borrado')
    const arrow = w.get('[data-testid="delete-arrow"]')
    const end = w.get('[data-testid="delete-end"]')
    expect(arrow.text()).toBe('Borrar flecha')
    expect(arrow.attributes('aria-label')).toBe('Borrar flecha seleccionada')
    expect(end.text()).toBe('Borrar tanda')
    expect(end.attributes('aria-label')).toBe('Borrar tanda seleccionada')
    for (const b of [arrow, end]) {
      expect(b.attributes('type')).toBe('button')
      // aria-disabled, never native disabled (keeps focus for the dialog's focus return).
      expect(b.attributes('disabled')).toBeUndefined()
    }
  })

  it('enabled buttons have no aria-disabled and emit on click', async () => {
    const w = actions()
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBeUndefined()
    expect(w.get('[data-testid="delete-end"]').attributes('aria-disabled')).toBeUndefined()
    await w.get('[data-testid="delete-arrow"]').trigger('click')
    await w.get('[data-testid="delete-end"]').trigger('click')
    expect(w.emitted('deleteArrow')).toHaveLength(1)
    expect(w.emitted('deleteEnd')).toHaveLength(1)
  })

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])(
    'canDeleteArrow=%s, canDeleteEnd=%s: disabled ones are aria-disabled and silent',
    async (a, e) => {
      const w = actions(a, e)
      const arrow = w.get('[data-testid="delete-arrow"]')
      const end = w.get('[data-testid="delete-end"]')
      expect(arrow.attributes('aria-disabled')).toBe(a ? undefined : 'true')
      expect(end.attributes('aria-disabled')).toBe(e ? undefined : 'true')
      await arrow.trigger('click')
      await end.trigger('click')
      expect(w.emitted('deleteArrow')?.length ?? 0).toBe(a ? 1 : 0)
      expect(w.emitted('deleteEnd')?.length ?? 0).toBe(e ? 1 : 0)
    },
  )

  it('reacts to prop changes', async () => {
    const w = actions(false, false)
    await w.setProps({ canDeleteArrow: true, canDeleteEnd: true })
    expect(w.get('[data-testid="delete-arrow"]').attributes('aria-disabled')).toBeUndefined()
    expect(w.get('[data-testid="delete-end"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('exposes the «Borrar tanda» button for focus return', () => {
    const w = actions()
    const exposed = (w.vm as unknown as { endButton: HTMLButtonElement | null }).endButton
    expect(exposed).toBe(w.get('[data-testid="delete-end"]').element)
  })
})
