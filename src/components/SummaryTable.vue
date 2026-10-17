<script setup lang="ts">
import { computed } from 'vue'

// Read-only per-end table of the summary (CU-08): no arrows, just totals and tiebreak counts,
// so it fits 375 px for any session structure. Totals use the same shapes as ScoreGrid.
const props = defineProps<{
  endsPerSeries: number
  rowCount: number
  /** Per row: the end's total, or null when the end is unstarted (blank row). */
  endTotals: (number | null)[]
  /** Per row: the series running total, or null when the end is unstarted. */
  runningTotals: (number | null)[]
  /** Per series: its total. */
  seriesTotals: number[]
  grandTotal: number
  endMax: number
  seriesMax: number
  grandMax: number
  /** Tiebreak column values, best first (0–2 of them). */
  tiebreakPoints: number[]
  /** Per row / per series / whole session: one count per tiebreak column. */
  endCounts: number[][]
  seriesCounts: number[][]
  grandCounts: number[]
}>()

/** Row indexes grouped by series: series of a row = floor(row / endsPerSeries). */
const series = computed(() => {
  const size = Math.max(1, props.endsPerSeries)
  const groups: number[][] = []
  for (let row = 0; row < props.rowCount; row++) (groups[Math.floor(row / size)] ??= []).push(row)
  return groups
})

const columnCount = computed(() => 3 + props.tiebreakPoints.length)

/** Blank for an unstarted end. */
function shown(value: number | null | undefined, max?: number): string {
  if (value === null || value === undefined) return ''
  return max === undefined ? String(value) : `${value}/${max}`
}

/** Counts of an unstarted end stay blank, like its totals. */
function endCount(row: number, k: number): string {
  if (props.endTotals[row] === null || props.endTotals[row] === undefined) return ''
  return String(props.endCounts[row]?.[k] ?? 0)
}
</script>

<template>
  <table class="summary-table" aria-label="Resumen por tandas">
    <colgroup>
      <col class="col-end" />
      <col class="col-total" />
      <col class="col-running" />
      <col v-for="p in tiebreakPoints" :key="p" />
    </colgroup>
    <thead>
      <tr>
        <th scope="col"><abbr title="Tanda">T.</abbr></th>
        <th scope="col">Total</th>
        <th scope="col"><abbr title="Acumulado">Acum.</abbr></th>
        <th v-for="p in tiebreakPoints" :key="p" scope="col" :aria-label="`Flechas de ${p}`">
          {{ p }}
        </th>
      </tr>
    </thead>
    <tbody v-for="(rows, s) in series" :key="s">
      <tr>
        <th scope="rowgroup" :colspan="columnCount" class="series-title">
          {{ `Serie ${s + 1}` }}
        </th>
      </tr>
      <tr v-for="row in rows" :key="row">
        <th scope="row">{{ (row % endsPerSeries) + 1 }}</th>
        <td class="num" :data-testid="`summary-end-total-${row}`">
          {{ shown(endTotals[row], endMax) }}
        </td>
        <td class="num" :data-testid="`summary-running-total-${row}`">
          {{ shown(runningTotals[row]) }}
        </td>
        <td
          v-for="(p, k) in tiebreakPoints"
          :key="p"
          class="num"
          :data-testid="`summary-count-${row}-${k}`"
        >
          {{ endCount(row, k) }}
        </td>
      </tr>
      <tr class="series-row">
        <th scope="row" colspan="3" class="total-label" :data-testid="`summary-series-total-${s}`">
          {{ `Total Serie ${s + 1}: ${seriesTotals[s] ?? 0}/${seriesMax}` }}
        </th>
        <td
          v-for="(p, k) in tiebreakPoints"
          :key="p"
          class="num"
          :data-testid="`summary-series-count-${s}-${k}`"
        >
          {{ seriesCounts[s]?.[k] ?? 0 }}
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="grand-row">
        <th scope="row" colspan="3" class="total-label" data-testid="summary-grand-total">
          {{ `TOTAL GENERAL: ${grandTotal}/${grandMax}` }}
        </th>
        <td
          v-for="(p, k) in tiebreakPoints"
          :key="p"
          class="num"
          :data-testid="`summary-grand-count-${k}`"
        >
          {{ grandCounts[k] ?? 0 }}
        </td>
      </tr>
    </tfoot>
  </table>
</template>

<style scoped>
/*
 * Fixed layout sized for wide fallback fonts (Verdana / DejaVu Sans): «132/132» fits the Total
 * column; the tiebreak columns share what is left of 343 px.
 */
.summary-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.col-end {
  width: 1.875rem;
}

.col-total {
  width: 4rem;
}

.col-running {
  width: 3.5rem;
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

thead th {
  font-size: 0.6875rem;
}

.series-title {
  padding: var(--space-3) 0 var(--space-1);
  text-align: left;
  font-weight: 700;
  color: var(--color-text);
}

.num {
  padding: 0 2px;
  height: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: -0.02em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border: 1px solid var(--color-border);
}

.total-label {
  padding: var(--space-2) var(--space-1);
  text-align: right;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  white-space: normal;
  overflow-wrap: anywhere;
}

.grand-row .total-label {
  font-size: 1.0625rem;
}
</style>
