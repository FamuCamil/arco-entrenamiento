<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue'

import ScoreCell from '@/components/ScoreCell.vue'
import type { Cell, End } from '@/domain/types'

const props = defineProps<{
  ends: End[]
  endsPerSeries: number
  selected: Cell
  /** Receives the element of the selected row (for scrolling it into view). */
  registerActiveRow: (el: HTMLElement) => void
}>()

/** Row indexes of `ends`, grouped by series: series of a row = floor(row / endsPerSeries). */
const series = computed(() => {
  const groups: number[][] = []
  props.ends.forEach((_, row) => {
    const s = Math.floor(row / props.endsPerSeries)
    ;(groups[s] ??= []).push(row)
  })
  return groups
})

const arrowsPerEnd = computed(() => props.ends[0]?.length ?? 0)

// Stable function ref: Vue calls it with null when the row stops being active, which is ignored.
function onActiveRow(el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) props.registerActiveRow(el)
}
</script>

<template>
  <div class="score-grid">
    <table v-for="(rows, s) in series" :key="s" class="series">
      <caption class="series-title">
        {{
          `Serie ${s + 1}`
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="col-end">Tanda</th>
          <th v-for="col in arrowsPerEnd" :key="col" scope="col">{{ col }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row"
          :ref="row === selected.row ? onActiveRow : undefined"
          :data-testid="`score-row-${row}`"
        >
          <th scope="row" class="col-end">{{ (row % endsPerSeries) + 1 }}</th>
          <ScoreCell
            v-for="(value, col) in ends[row]"
            :key="col"
            :value="value"
            :selected="row === selected.row && col === selected.col"
            :data-testid="`score-cell-${row}-${col}`"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.series {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}

.series-title {
  text-align: left;
  font-weight: 700;
  padding: var(--space-2) 0;
}

th {
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--space-1);
}

.col-end {
  width: 3.5rem;
  text-align: center;
}
</style>
