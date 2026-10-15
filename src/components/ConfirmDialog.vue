<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useConfirm } from '@/composables/useConfirm'

// Single host for useConfirm, mounted once in App.vue. A div with role="dialog" rather than
// <dialog>/showModal, which jsdom does not support reliably.
const { state, settle } = useConfirm()

const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)

/**
 * Escape and the Tab trap listen on document while open, so they keep working even if a click
 * on the panel padding moved focus to body.
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    settle(false)
    return
  }
  if (event.key !== 'Tab') return
  const first = cancelButton.value
  const last = confirmButton.value
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && (active === first || !isInside(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !isInside(active))) {
    event.preventDefault()
    first.focus()
  }
}

function isInside(el: Element | null): boolean {
  return el === cancelButton.value || el === confirmButton.value
}

watch(
  () => state.value !== null,
  async (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      cancelButton.value?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="state" class="backdrop" data-testid="confirm-backdrop" @click.self="settle(false)">
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <h2 id="confirm-dialog-title" class="title">{{ state.title }}</h2>
      <p id="confirm-dialog-message" class="message">{{ state.message }}</p>
      <div class="buttons">
        <button
          ref="cancelButton"
          type="button"
          class="button cancel"
          data-testid="confirm-cancel"
          @click="settle(false)"
        >
          {{ state.cancelLabel }}
        </button>
        <button
          ref="confirmButton"
          type="button"
          class="button confirm"
          data-testid="confirm-accept"
          @click="settle(true)"
        >
          {{ state.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Bottom-anchored on phones for thumb reach; centered panel on wider screens. */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-4) calc(var(--space-4) + var(--safe-right))
    calc(var(--space-4) + var(--safe-bottom)) calc(var(--space-4) + var(--safe-left));
  background: rgb(0 0 0 / 0.5);
}

.panel {
  width: 100%;
  max-width: 28rem;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
}

.message {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
}

.buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.button {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.cancel {
  background: var(--color-surface);
  color: var(--color-text);
}

/* --color-accent-contrast is white in light and near-black in dark: readable on both reds. */
.confirm {
  border-color: var(--color-danger);
  background: var(--color-danger);
  color: var(--color-accent-contrast);
}

@media (min-width: 40rem) {
  .backdrop {
    align-items: center;
  }
}
</style>
