<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import LockIcon from '@/components/LockIcon.vue'
import SummaryTable from '@/components/SummaryTable.vue'
import { useSessionStats } from '@/composables/useSessionStats'
import { formatDisplayDate } from '@/domain/dates'
import { tiebreakTable, zoneDistribution } from '@/domain/summary'
import { getTargetFace } from '@/domain/targetFaces'
import { useSessionsStore } from '@/stores/sessions'

// Read-only summary of one archer of a session (CU-08). Writes nothing.
const props = defineProps<{
  id: string
  /** From `?archer=`; the first archer when missing. */
  archerId?: string
}>()

const store = useSessionsStore()

const session = computed(() => store.getSession(props.id))
// Resolved once, like the scoring screen reads its params: App.vue keys views by path.
const resolvedArcherId = props.archerId ?? session.value?.archers[0]?.id
const archer = computed(() =>
  resolvedArcherId === undefined ? undefined : store.getArcher(props.id, resolvedArcherId),
)
const face = computed(() => (session.value ? getTargetFace(session.value.faceId) : undefined))
// Same totals path as the scoring screen, so every figure matches it.
const stats = useSessionStats(props.id, resolvedArcherId ?? '')

const ends = computed(() => archer.value?.ends ?? [])
const tiebreaks = computed(() =>
  face.value && session.value
    ? tiebreakTable(ends.value, session.value.endsPerSeries, face.value)
    : { points: [], perEnd: [], perSeries: [], total: [] },
)
const distribution = computed(() => (face.value ? zoneDistribution(ends.value, face.value) : []))

const dateLabel = computed(() => (session.value ? formatDisplayDate(session.value.date) : ''))
const placeLabel = computed(() => session.value?.location.trim() || 'Sin lugar')
const distanceLabel = computed(() =>
  session.value?.distance === 0 ? 'Variable' : `${session.value?.distance} m`,
)
const isClosed = computed(() => session.value?.closed ?? false)

const heading = ref<HTMLElement | null>(null)

// Focus lands on the heading on every mount (CU-10's «Finalizar» leads here).
onMounted(() => heading.value?.focus())
</script>

<template>
  <section v-if="session && face && archer" class="summary">
    <header class="summary-header">
      <h2 ref="heading" tabindex="-1" class="summary-title">Resumen</h2>
      <p class="summary-archer" data-testid="summary-archer">
        {{ archer.position }} - {{ archer.name }}
      </p>
      <p class="summary-meta" data-testid="summary-date-place">
        {{ dateLabel }} · <span class="summary-place">{{ placeLabel }}</span>
      </p>
      <p class="summary-meta" data-testid="summary-distance-face">
        {{ distanceLabel }} · {{ face.name }}
      </p>
      <p v-if="isClosed" class="summary-meta summary-status" data-testid="summary-status">
        <LockIcon class="status-icon" />
        <span>Finalizada</span>
      </p>
    </header>

    <nav class="summary-nav" aria-label="Navegación del resumen">
      <RouterLink
        class="nav-link"
        :to="{ name: 'scoring', params: { id, archerId: archer.id } }"
        data-testid="summary-back"
      >
        {{ isClosed ? 'Ver tabla' : 'Volver a anotar' }}
      </RouterLink>
      <RouterLink class="nav-link" to="/" data-testid="summary-home">Inicio</RouterLink>
    </nav>

    <SummaryTable
      :ends-per-series="session.endsPerSeries"
      :row-count="archer.ends.length"
      :end-totals="stats.endTotals.value"
      :running-totals="stats.runningTotals.value"
      :series-totals="stats.seriesTotals.value"
      :grand-total="stats.grandTotal.value"
      :end-max="stats.endMax.value"
      :series-max="stats.seriesMax.value"
      :grand-max="stats.grandMax.value"
      :tiebreak-points="tiebreaks.points"
      :end-counts="tiebreaks.perEnd"
      :series-counts="tiebreaks.perSeries"
      :grand-counts="tiebreaks.total"
    />

    <p class="summary-average" data-testid="summary-average">{{ stats.averageLabel.value }}</p>

    <h3 id="zone-distribution-title" class="distribution-title">Reparto por zonas</h3>
    <ul class="distribution" aria-labelledby="zone-distribution-title">
      <li
        v-for="{ zone, count } in distribution"
        :key="zone.key"
        class="zone"
        :data-testid="`zone-count-${zone.key}`"
      >
        <span class="zone-chip" :style="{ background: zone.bg, color: zone.fg }">
          {{ zone.key }}
        </span>
        <span class="zone-count">{{ count }}</span>
      </li>
    </ul>
  </section>

  <section v-else class="not-found">
    <p>{{ session && face ? 'No se encontró el arquero.' : 'No se encontró la sesión.' }}</p>
    <RouterLink to="/">Volver al inicio</RouterLink>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.summary-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.summary-title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.summary-archer {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.summary-meta {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.summary-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.status-icon {
  flex: none;
  width: 1em;
  height: 1em;
}

.summary-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

/* Outlined accent, like «Finalizar sesión». */
.nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-accent);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  overflow-wrap: anywhere;
  touch-action: manipulation;
}

.summary-average {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.distribution-title {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-base);
}

.distribution {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.zone {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.zone-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 var(--space-1);
  border: 1px solid #6b7280;
  border-radius: var(--radius);
  font-weight: 700;
}
</style>
