<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ScoreGrid from '@/components/ScoreGrid.vue'
import ScoreKeypad from '@/components/ScoreKeypad.vue'
import { useScoring } from '@/composables/useScoring'

const props = defineProps<{
  id: string
  archerId: string
}>()

const { session, archer, face, selected, isLocked, score, activeRowRef } = useScoring(
  props.id,
  props.archerId,
)

function registerActiveRow(el: HTMLElement) {
  activeRowRef.value = el
}
</script>

<template>
  <section v-if="session && archer && face" class="scoring">
    <h2 class="archer">{{ archer.position }} - {{ archer.name }}</h2>

    <div class="grid-scroller">
      <ScoreGrid
        :ends="archer.ends"
        :ends-per-series="session.endsPerSeries"
        :selected="selected"
        :register-active-row="registerActiveRow"
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
    <ScoreKeypad v-else class="keypad" :face="face" @score="score" />
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

.archer {
  flex: none;
  margin: 0;
  font-size: var(--font-size-lg);
}

.grid-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.keypad,
.locked {
  flex: none;
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
