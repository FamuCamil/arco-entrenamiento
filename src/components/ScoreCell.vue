<script setup lang="ts">
// When interactive, a native button fills the cell: tap, Tab focus and Enter/Space select it (CU-04).
defineProps<{
  value: string | null
  selected: boolean
  /** Accessible name of the cell button (series, end, arrow and value). */
  label: string
  /**
   * False in a closed session: the value is plain text, nothing can be selected and no cell shows
   * as selected (CU-10).
   */
  interactive: boolean
}>()

const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <td
    class="score-cell"
    :class="{ 'is-selected': selected && interactive, 'is-interactive': interactive }"
    :aria-current="(selected && interactive) || undefined"
  >
    <button
      v-if="interactive"
      type="button"
      class="cell-button"
      :aria-label="label"
      @click="emit('select')"
    >
      {{ value ?? '' }}
    </button>
    <template v-else>{{ value ?? '' }}</template>
  </td>
</template>

<style scoped>
.score-cell {
  height: var(--touch-min);
  padding: 0 var(--space-1);
  text-align: center;
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.score-cell.is-interactive {
  padding: 0;
}

.score-cell.is-selected {
  background: var(--color-selected-bg);
  outline: 3px solid var(--color-selected-border);
  outline-offset: -3px;
}

.cell-button {
  display: block;
  width: 100%;
  min-height: var(--touch-min);
  margin: 0;
  padding: 0 var(--space-1);
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

/* Inset and dashed, so it stays inside the scroller's clip and differs from the selected outline. */
.cell-button:focus-visible {
  outline: 2px dashed var(--color-text);
  outline-offset: -7px;
}
</style>
