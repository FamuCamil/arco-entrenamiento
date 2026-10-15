<script setup lang="ts">
import type { TargetFace } from '@/domain/types'

defineProps<{
  face: TargetFace
  disabled?: boolean
}>()

const emit = defineEmits<{
  score: [key: string]
}>()

function label(key: string): string {
  return key === 'M' ? 'Anotar fallo' : `Anotar ${key}`
}
</script>

<template>
  <div class="keypad" role="group" aria-label="Teclado de puntuación">
    <!-- One key per zone, in catalog order; colors come from the zone, never from the key text. -->
    <button
      v-for="zone in face.zones"
      :key="zone.key"
      type="button"
      class="key"
      :style="{ background: zone.bg, color: zone.fg }"
      :aria-label="label(zone.key)"
      :data-testid="`key-${zone.key}`"
      :disabled="disabled"
      @click="emit('score', zone.key)"
    >
      {{ zone.key }}
    </button>
  </div>
</template>

<style scoped>
.keypad {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--touch-min), 1fr));
  gap: var(--space-2);
}

.key {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font: inherit;
  /* Large bold text: white on red/blue only meets contrast as large text. */
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.key:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
