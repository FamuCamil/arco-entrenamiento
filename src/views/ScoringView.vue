<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import LockIcon from '@/components/LockIcon.vue'
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
  closeSession,
  reopenSession,
  activeRowRef,
} = useScoring(props.id, props.archerId)
const stats = useSessionStats(props.id, props.archerId)
const { confirm } = useConfirm()
const router = useRouter()

const root = ref<HTMLElement | null>(null)
const actions = ref<InstanceType<typeof ScoreActions> | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

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

/**
 * Asks before finalizing (CU-10); on confirm it closes the session and opens its summary
 * (CU-08), whose heading takes focus. On cancel useConfirm returns focus to «Finalizar sesión».
 */
async function confirmClose() {
  const ok = await confirm({
    title: '¿Finalizar la sesión?',
    message: 'La sesión quedará en solo lectura. Podrás reabrirla cuando quieras.',
    confirmLabel: 'Finalizar',
    danger: false,
    returnFocusTo: closeButton.value ?? undefined,
  })
  if (!ok) return
  closeSession()
  await router.push({
    name: 'summary',
    params: { id: props.id },
    query: { archer: props.archerId },
  })
}

/** Reopens at once (no confirmation) and focuses the selected cell, or the first key. */
async function onReopen() {
  reopenSession()
  await nextTick()
  const target =
    root.value?.querySelector<HTMLElement>('.score-cell[aria-current="true"] .cell-button') ??
    root.value?.querySelector<HTMLElement>('.controls button')
  target?.focus()
}

function registerActiveRow(el: HTMLElement) {
  activeRowRef.value = el
}
</script>

<template>
  <section v-if="session && archer && face" ref="root" class="scoring">
    <div class="scoring-header">
      <div class="header-text">
        <h2 class="archer">{{ archer.position }} - {{ archer.name }}</h2>
        <p class="average" data-testid="average">{{ stats.averageLabel.value }}</p>
      </div>
      <RouterLink
        class="open-summary"
        :to="{ name: 'summary', params: { id }, query: { archer: archerId } }"
        data-testid="open-summary"
      >
        Resumen
      </RouterLink>
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

    <div v-if="isLocked" class="locked-panel">
      <div class="locked" role="status">
        <LockIcon class="lock-icon" />
        <span>Sesión finalizada — solo lectura</span>
      </div>
      <button type="button" class="reopen" data-testid="reopen-session" @click="onReopen">
        Reabrir sesión
      </button>
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
      <button
        ref="closeButton"
        type="button"
        class="close-session"
        data-testid="close-session"
        @click="confirmClose"
      >
        Finalizar sesión
      </button>
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
  align-items: center;
  gap: var(--space-3);
}

/* Long names wrap here; «Resumen» keeps its width on the right. */
.header-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

/* Outlined accent link (CU-08), like «Finalizar sesión». */
.open-summary {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  touch-action: manipulation;
}

.archer {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
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
.locked-panel {
  flex: none;
}

.controls,
.locked-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Outlined accent: set apart from the delete actions and never danger red (CU-10). */
.close-session,
.reopen {
  width: 100%;
  min-height: var(--touch-min);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.close-session {
  margin-top: var(--space-1);
  background: var(--color-surface);
  color: var(--color-accent);
}

/* Filled accent, like «Nueva sesión». */
.reopen {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
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
