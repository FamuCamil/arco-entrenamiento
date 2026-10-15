<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">Arco · Entrenamientos</h1>
  </header>
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  padding: calc(var(--space-3) + var(--safe-top)) calc(var(--space-4) + var(--safe-right))
    var(--space-3) calc(var(--space-4) + var(--safe-left));
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
}

.app-title {
  margin: 0;
  font-size: var(--font-size-lg);
}

.app-main {
  padding: var(--space-4) calc(var(--space-4) + var(--safe-right))
    calc(var(--space-4) + var(--safe-bottom)) calc(var(--space-4) + var(--safe-left));
}
</style>
