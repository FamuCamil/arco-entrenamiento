<script setup lang="ts">
// Display-only in this use case: selecting a cell by tapping arrives with CU-04.
defineProps<{
  value: string | null
  selected: boolean
}>()
</script>

<template>
  <td class="score-cell" :class="{ 'is-selected': selected }" :aria-current="selected || undefined">
    {{ value ?? '' }}
  </td>
</template>

<style scoped>
.score-cell {
  min-width: 2.75rem;
  height: 2.5rem;
  padding: 0 var(--space-1);
  text-align: center;
  font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.score-cell.is-selected {
  background: var(--color-selected-bg);
  outline: 3px solid var(--color-selected-border);
  outline-offset: -3px;
}
</style>
