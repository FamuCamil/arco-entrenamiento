<script setup lang="ts">
import { RouterView } from 'vue-router'

import ConfirmDialog from '@/components/ConfirmDialog.vue'
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">Arco · Entrenamientos</h1>
  </header>
  <main class="app-main">
    <!-- Keyed by path: views read route params once, so a new URL mounts a fresh view. -->
    <RouterView :key="$route.path" />
  </main>
  <ConfirmDialog />
</template>

<style scoped>
.app-header {
  flex: none;
  padding: calc(var(--space-3) + var(--safe-top)) calc(var(--space-4) + var(--safe-right))
    var(--space-3) calc(var(--space-4) + var(--safe-left));
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
}

.app-title {
  margin: 0;
  font-size: var(--font-size-lg);
}

/* Fills the space below the header; views that need their own scroller (scoring) can use flex. */
.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--space-4) calc(var(--space-4) + var(--safe-right))
    calc(var(--space-4) + var(--safe-bottom)) calc(var(--space-4) + var(--safe-left));
}
</style>
