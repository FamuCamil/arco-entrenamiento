<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import ScoreActions from '@/components/ScoreActions.vue'
import ScoreGrid from '@/components/ScoreGrid.vue'
import ScoreKeypad from '@/components/ScoreKeypad.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useScoring } from '@/composables/useScoring'
import { useSessionStats } from '@/composables/useSessionStats'

const props = defineProps<{
  id: string
  archerId: string
}>()

const {
  session,
  archer,
  face,
  selected,
  isLocked,
  select,
  score,
  canDeleteArrow,
  canDeleteEnd,
  deleteArrow,
  deleteEnd,
  activeRowRef,
} = useScoring(props.id, props.archerId)
const stats = useSessionStats(props.id, props.archerId)
const { confirm } = useConfirm()

const actions = ref<InstanceType<typeof ScoreActions> | null>(null)

/** Asks before emptying the whole end; nothing changes on cancel. */
async function confirmDeleteEnd() {
  if (!session.value) return
  const { row } = selected.value
  const series = Math.floor(row / session.value.endsPerSeries) + 1
  const end = (row % session.value.endsPerSeries) + 1
  const ok = await confirm({
    title: '¿Borrar la tanda?',
    message: `Se borrarán todas las flechas de la serie ${series}, tanda ${end}. No se puede deshacer.`,
    confirmLabel: 'Borrar',
    returnFocusTo: actions.value?.endButton ?? undefined,
  })
  if (ok) deleteEnd()
}

function registerActiveRow(el: HTMLElement) {
  activeRowRef.value = el
}
</script>

<template>
  <section v-if="session && archer && face" class="scoring">
    <div class="scoring-header">
      <h2 class="archer">{{ archer.position }} - {{ archer.name }}</h2>
      <p class="average" data-testid="average">{{ stats.averageLabel.value }}</p>
    </div>

    <div class="grid-scroller">
      <ScoreGrid
        :ends="archer.ends"
        :ends-per-series="session.endsPerSeries"
        :selected="selected"
        :register-active-row="registerActiveRow"
        :interactive="!isLocked"
        :end-totals="stats.endTotals.value"
        :running-totals="stats.runningTotals.value"
        :series-totals="stats.seriesTotals.value"
        :grand-total="stats.grandTotal.value"
        :end-max="stats.endMax.value"
        :series-max="stats.seriesMax.value"
        :grand-max="stats.grandMax.value"
        @select="select"
      />
    </div>

    <div v-if="isLocked" class="locked" role="status">
      <svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"
          fill="currentColor"
        />
      </svg>
      <span>Sesión finalizada — solo lectura</span>
    </div>
    <div v-else class="controls">
      <ScoreKeypad :face="face" @score="score" />
      <ScoreActions
        ref="actions"
        :can-delete-arrow="canDeleteArrow"
        :can-delete-end="canDeleteEnd"
        @delete-arrow="deleteArrow"
        @delete-end="confirmDeleteEnd"
      />
    </div>
  </section>

  <section v-else class="not-found">
    <p>No se encontró la sesión.</p>
    <RouterLink to="/">Volver al inicio</RouterLink>
  </section>
</template>

<style scoped>
.scoring {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.scoring-header {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

.archer {
  margin: 0;
  font-size: var(--font-size-lg);
}

.average {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.grid-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.controls,
.locked {
  flex: none;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.locked {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  font-weight: 600;
}

.lock-icon {
  width: 1.5rem;
  height: 1.5rem;
}
</style>
