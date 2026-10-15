<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  canDeleteArrow: boolean
  canDeleteEnd: boolean
}>()

const emit = defineEmits<{
  deleteArrow: []
  deleteEnd: []
}>()

const endButton = ref<HTMLButtonElement | null>(null)

// The view hands this to useConfirm as returnFocusTo (taps don't focus buttons on iOS Safari).
defineExpose({ endButton })

// aria-disabled instead of native disabled: a disabled button would lose focus, and the
// confirmation dialog must return focus to «Borrar tanda» after it empties the end.
function onDeleteArrow(): void {
  if (props.canDeleteArrow) emit('deleteArrow')
}

function onDeleteEnd(): void {
  if (props.canDeleteEnd) emit('deleteEnd')
}
</script>

<template>
  <div class="actions" role="group" aria-label="Acciones de borrado">
    <button
      type="button"
      class="action"
      aria-label="Borrar flecha seleccionada"
      data-testid="delete-arrow"
      :aria-disabled="canDeleteArrow ? undefined : 'true'"
      @click="onDeleteArrow"
    >
      Borrar flecha
    </button>
    <button
      ref="endButton"
      type="button"
      class="action end"
      aria-label="Borrar tanda seleccionada"
      data-testid="delete-end"
      :aria-disabled="canDeleteEnd ? undefined : 'true'"
      @click="onDeleteEnd"
    >
      Borrar tanda
    </button>
  </div>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.action {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.end {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
