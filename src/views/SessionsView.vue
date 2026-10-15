<script setup lang="ts">
// TODO(CU-09): session list, newest first, plus export/import (CU-15).
import { useRouter } from 'vue-router'

import { localIsoDate } from '@/domain/dates'
import { getTemplate } from '@/domain/templates'
import { useSessionsStore } from '@/stores/sessions'

const router = useRouter()
const store = useSessionsStore()

// TODO(CU-01): provisional «Sesión de prueba» until real session creation lands in F2.
// Remove this block (constant, handler and button) together.
const TEST_SESSION_LOCATION = 'Sesión de prueba'

function openTestSession() {
  let session = store.sessions.find((s) => s.location === TEST_SESSION_LOCATION)
  if (!session) {
    const preset = getTemplate('sala-18')?.preset
    if (!preset) return
    session = store.createSession({
      ...preset,
      date: localIsoDate(),
      location: TEST_SESSION_LOCATION,
    })
  }
  const archer = session.archers[0]
  if (!archer) return
  void router.push({ name: 'scoring', params: { id: session.id, archerId: archer.id } })
}
// END TODO(CU-01)
</script>

<template>
  <section>
    <h2>Sesiones</h2>
    <p class="empty">Todavía no hay sesiones de entrenamiento.</p>
    <!-- TODO(CU-01): provisional button, remove with the block above. -->
    <button type="button" class="test-session" @click="openTestSession">Sesión de prueba</button>
  </section>
</template>

<style scoped>
.empty {
  color: var(--color-text-muted);
}

.test-session {
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
</style>
