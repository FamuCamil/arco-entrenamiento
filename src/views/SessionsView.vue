<script setup lang="ts">
// TODO(CU-09): provisional list (date and location only); CU-09 replaces it with the session
// cards, plus export/import (CU-15).
import { RouterLink, useRouter } from 'vue-router'

import { formatDisplayDate } from '@/domain/dates'
import { useSessionsStore } from '@/stores/sessions'

const router = useRouter()
const store = useSessionsStore()

function newSession() {
  void router.push({ name: 'new-session' })
}
</script>

<template>
  <section>
    <h2>Sesiones</h2>
    <button type="button" class="new-session" @click="newSession">Nueva sesión</button>
    <ul v-if="store.sortedSessions.length > 0" class="session-list" aria-label="Sesiones guardadas">
      <li v-for="session in store.sortedSessions" :key="session.id">
        <RouterLink
          v-if="session.archers[0]"
          class="session-link"
          :to="{ name: 'scoring', params: { id: session.id, archerId: session.archers[0].id } }"
        >
          {{ formatDisplayDate(session.date) }} · {{ session.location.trim() || 'Sin lugar' }}
        </RouterLink>
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

.session-link {
  display: flex;
  align-items: center;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
  overflow-wrap: anywhere;
}
</style>
