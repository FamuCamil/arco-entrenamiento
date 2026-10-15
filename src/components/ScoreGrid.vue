<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue'

import ScoreCell from '@/components/ScoreCell.vue'
import type { Cell, End } from '@/domain/types'

// The stats props default to an empty scoresheet, so the grid renders before any totals exist.
const props = withDefaults(
  defineProps<{
    ends: End[]
    endsPerSeries: number
    selected: Cell
    /** Receives the element of the selected row (for scrolling it into view). */
    registerActiveRow: (el: HTMLElement) => void
    /** Cells can be selected (false in a closed session). */
    interactive: boolean
    /** Per row: the end's total, or null when the end is unstarted (blank cell). */
    endTotals?: (number | null)[]
    /** Per row: the series running total, or null when the end is unstarted (blank cell). */
    runningTotals?: (number | null)[]
    /** Per series: its total. */
    seriesTotals?: number[]
    grandTotal?: number
    endMax?: number
    seriesMax?: number
    grandMax?: number
  }>(),
  {
    endTotals: () => [],
    runningTotals: () => [],
    seriesTotals: () => [],
    grandTotal: 0,
    endMax: 0,
    seriesMax: 0,
    grandMax: 0,
  },
)

const emit = defineEmits<{ select: [row: number, col: number] }>()

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

/** Blank for an unstarted end. */
function shown(value: number | null | undefined, max?: number): string {
  if (value === null || value === undefined) return ''
  return max === undefined ? String(value) : `${value}/${max}`
}

/** Accessible name of a cell: series, end within the series, arrow and value. */
function cellLabel(row: number, col: number, value: string | null): string {
  const s = Math.floor(row / props.endsPerSeries) + 1
  const end = (row % props.endsPerSeries) + 1
  const shown = value === null ? 'vacía' : value === 'M' ? 'fallo' : value
  return `Serie ${s}, tanda ${end}, flecha ${col + 1}: ${shown}`
}

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
      <colgroup>
        <col class="col-end" />
        <col v-for="col in arrowsPerEnd" :key="col" />
        <col class="col-total" />
        <col class="col-running" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col"><abbr title="Tanda">T.</abbr></th>
          <th v-for="col in arrowsPerEnd" :key="col" scope="col">{{ col }}</th>
          <th scope="col" class="total-head">Total</th>
          <th scope="col" class="total-head"><abbr title="Acumulado">Acum.</abbr></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row"
          :ref="row === selected.row ? onActiveRow : undefined"
          :data-testid="`score-row-${row}`"
        >
          <th scope="row">{{ (row % endsPerSeries) + 1 }}</th>
          <ScoreCell
            v-for="(value, col) in ends[row]"
            :key="col"
            :value="value"
            :selected="row === selected.row && col === selected.col"
            :label="cellLabel(row, col, value)"
            :interactive="interactive"
            :data-testid="`score-cell-${row}-${col}`"
            @select="emit('select', row, col)"
          />
          <td class="total" :data-testid="`end-total-${row}`">
            {{ shown(endTotals[row], endMax) }}
          </td>
          <td class="total" :data-testid="`running-total-${row}`">
            {{ shown(runningTotals[row]) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td :colspan="arrowsPerEnd + 3" class="series-total" :data-testid="`series-total-${s}`">
            {{ `Total Serie ${s + 1}: ${seriesTotals[s] ?? 0}/${seriesMax}` }}
          </td>
        </tr>
      </tfoot>
    </table>
    <p class="grand-total" data-testid="grand-total">
      {{ `TOTAL GENERAL: ${grandTotal}/${grandMax}` }}
    </p>
  </div>
</template>

<style scoped>
/* Fixed layout: 6 arrows + totals fit 343 px (375 px minus the gutters), so cells shrink in width. */
.series {
  width: 100%;
  table-layout: fixed;
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
  padding: var(--space-1) 2px;
  text-align: center;
  white-space: nowrap;
}

abbr {
  text-decoration: none;
}

/*
 * Sized for wide fallback fonts (Verdana / DejaVu Sans on Linux), not just the macOS system font:
 * «60/60» and «Acum.» must fit with any common sans. Arrow columns keep ~34 px at 375 px.
 */
.col-end {
  width: 1.875rem;
}

.col-total {
  width: 3.375rem;
}

.col-running {
  width: 2.875rem;
}

.total-head {
  font-size: 0.6875rem;
}

.total {
  padding: 0 2px;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: -0.02em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border: 1px solid var(--color-border);
}

.series-total,
.grand-total {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.series-total {
  padding: var(--space-2) 2px;
  text-align: right;
}

.grand-total {
  margin: 0 0 var(--space-4);
  text-align: right;
  font-size: var(--font-size-lg);
}
</style>
