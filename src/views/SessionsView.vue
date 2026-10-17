<script setup lang="ts">
// Home: session cards, most recent first (CU-09). Export/import (CU-15) is still pending.
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import SessionCard from '@/components/SessionCard.vue'
import { useSessionsStore } from '@/stores/sessions'

const router = useRouter()
const store = useSessionsStore()

/** Sessions without an archer (defensive; shouldn't exist) have nothing to open, so no card. */
const listedSessions = computed(() =>
  store.sortedSessions.filter((session) => session.archers[0] !== undefined),
)

function newSession() {
  void router.push({ name: 'new-session' })
}
</script>

<template>
  <section>
    <h2>Sesiones</h2>
    <button type="button" class="new-session" @click="newSession">Nueva sesión</button>
    <ul v-if="listedSessions.length > 0" class="session-list" aria-label="Sesiones guardadas">
      <li v-for="session in listedSessions" :key="session.id">
        <SessionCard :session="session" />
      </li>
    </ul>
    <p v-else class="empty">Todavía no hay sesiones de entrenamiento.</p>
  </section>
</template>

<style scoped>
.empty {
  color: var(--color-text-muted);
}

.new-session {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border: none;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
</style>
