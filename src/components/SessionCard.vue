<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import LockIcon from '@/components/LockIcon.vue'
import TargetIcon from '@/components/TargetIcon.vue'
import { useSessionStats } from '@/composables/useSessionStats'
import { formatDisplayDate } from '@/domain/dates'
import { getTargetFace } from '@/domain/targetFaces'
import type { Session } from '@/domain/types'

const props = defineProps<{
  /** Must have at least one archer; the parent omits sessions without one. */
  session: Session
}>()

// Read once: the parent keys each card by session id.
const archer = props.session.archers[0]!
// Same totals path as the scoring screen, so the card always matches «TOTAL GENERAL».
const stats = useSessionStats(props.session.id, archer.id)

const face = computed(() => getTargetFace(props.session.faceId))
const dateLabel = computed(() => formatDisplayDate(props.session.date))
const placeLabel = computed(() => props.session.location.trim() || 'Sin lugar')
const distanceLabel = computed(() =>
  props.session.distance === 0 ? 'Variable' : `${props.session.distance} m`,
)
const faceName = computed(() => face.value?.name ?? props.session.faceId)
const structure = computed(
  () => `${props.session.seriesCount}×${props.session.endsPerSeries}×${props.session.arrowsPerEnd}`,
)
const totalLabel = computed(() => `Total ${stats.grandTotal.value}/${stats.grandMax.value}`)
/** «Promedio 9.03» or «Promedio —» (no colon on the card, unlike the scoring screen). */
const averageLabel = computed(() =>
  stats.average.value === null ? 'Promedio —' : `Promedio ${stats.average.value.toFixed(2)}`,
)
const isClosed = computed(() => props.session.closed)
const accessibleName = computed(() =>
  [
    dateLabel.value,
    placeLabel.value,
    distanceLabel.value,
    faceName.value,
    structure.value,
    totalLabel.value,
    averageLabel.value,
    ...(isClosed.value ? ['finalizada'] : []),
  ].join(', '),
)
</script>

<template>
  <RouterLink
    class="session-card"
    :to="{ name: 'scoring', params: { id: session.id, archerId: archer.id } }"
    :aria-label="accessibleName"
  >
    <TargetIcon v-if="face" :icon="face.icon" class="card-icon" />
    <span v-else class="card-icon" aria-hidden="true"></span>
    <span class="card-body">
      <span class="card-line card-date-place" data-testid="card-date-place">
        <span class="card-date">{{ dateLabel }}</span>
        <span class="card-sep" aria-hidden="true">{{ ' · ' }}</span>
        <span class="card-place">{{ placeLabel }}</span>
      </span>
      <span class="card-line card-meta" data-testid="card-distance-face">
        {{ distanceLabel }} · {{ faceName }}
      </span>
      <span class="card-line card-meta" data-testid="card-structure">{{ structure }}</span>
      <span class="card-line card-meta card-totals" data-testid="card-totals">
        <span class="card-total">{{ totalLabel }}</span>
        <span class="card-average">{{ averageLabel }}</span>
      </span>
      <span v-if="isClosed" class="card-line card-meta card-status" data-testid="card-status">
        <LockIcon class="card-status-icon" />
        <span>Finalizada</span>
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.session-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
  min-height: var(--touch-min);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
}

.session-card:hover {
  border-color: var(--color-accent);
}

.card-icon {
  display: block;
  width: 44px;
  height: 44px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-line {
  display: block;
}

.card-date-place {
  display: flex;
  min-width: 0;
  font-weight: 600;
}

.card-date,
.card-sep {
  flex: none;
  white-space: nowrap;
}

.card-sep {
  white-space: pre;
}

.card-place {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

/* The «·» lives in a pseudo-element left of the average; when the average wraps to its own
   line the dot falls left of the box and is clipped, so no line starts with «·». */
.card-totals {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1.2em;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
}

.card-total,
.card-average {
  white-space: nowrap;
}

.card-average {
  position: relative;
}

.card-average::before {
  content: '·';
  position: absolute;
  right: 100%;
  width: 1.2em;
  text-align: center;
}

/* Informative only (CU-10): to reopen, open the session. */
.card-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}

.card-status-icon {
  flex: none;
  width: 1em;
  height: 1em;
}
</style>
