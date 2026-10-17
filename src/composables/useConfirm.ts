import { nextTick, readonly, shallowRef } from 'vue'

export interface ConfirmOptions {
  title: string
  message: string
  /** Defaults to «Aceptar». */
  confirmLabel?: string
  /** Defaults to «Cancelar». */
  cancelLabel?: string
  /** Paints the confirm button in danger red. Defaults to true; false uses the accent colour. */
  danger?: boolean
  /**
   * Element that gets focus back when the dialog closes. Defaults to the element focused when
   * confirm() was called; pass it explicitly where taps don't focus buttons (iOS Safari).
   */
  returnFocusTo?: HTMLElement
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
}

// Module-level singleton: one dialog host (ConfirmDialog in App.vue) serves every caller.
const pending = shallowRef<ConfirmRequest | null>(null)
let resolver: ((result: boolean) => void) | null = null
let returnFocus: HTMLElement | null = null

function settle(result: boolean): void {
  const resolve = resolver
  const target = returnFocus
  resolver = null
  returnFocus = null
  pending.value = null
  resolve?.(result)
  if (target) {
    void nextTick(() => {
      if (target.isConnected) target.focus()
    })
  }
}

function confirm(options: ConfirmOptions): Promise<boolean> {
  // Only one dialog at a time: a newer request cancels the older one.
  if (resolver) settle(false)
  const active = typeof document !== 'undefined' ? document.activeElement : null
  returnFocus = options.returnFocusTo ?? (active instanceof HTMLElement ? active : null)
  pending.value = {
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel ?? 'Aceptar',
    cancelLabel: options.cancelLabel ?? 'Cancelar',
    danger: options.danger ?? true,
  }
  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

/**
 * App-owned confirmation dialog (never window.confirm). `confirm` resolves true or false;
 * `state` and `settle` are for the dialog host.
 *
 * @example
 * const { confirm } = useConfirm()
 * if (await confirm({ title: '¿Eliminar la sesión?', message: '…', confirmLabel: 'Eliminar' })) …
 */
export function useConfirm() {
  return { confirm, state: readonly(pending), settle }
}
