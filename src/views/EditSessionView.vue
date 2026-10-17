<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import SessionForm from '@/components/SessionForm.vue'
import { hasAnyArrow } from '@/domain/scoring'
import { sessionToFormValues, validateSessionEdit } from '@/domain/sessionForm'
import { useSessionsStore } from '@/stores/sessions'

// Edits a session's data (CU-11). Face and structure are locked once any arrow is scored.
const props = defineProps<{ id: string }>()

const router = useRouter()
const store = useSessionsStore()

const session = computed(() => store.getSession(props.id))
// Read once: App.vue keys views by path, so returning to this screen mounts a fresh form.
const values = ref(session.value ? sessionToFormValues(session.value) : null)
const locked = computed(() => (session.value ? hasAnyArrow(session.value.archers) : false))
const validation = computed(() =>
  values.value ? validateSessionEdit(values.value, locked.value) : { errors: {}, patch: null },
)
const saving = ref(false)

const heading = ref<HTMLElement | null>(null)

onMounted(() => heading.value?.focus())

/**
 * Back to this session's summary. When the summary pushed this screen, pop it, so the summary's
 * Back goes to scoring (not to a stale form) and its `?archer=` is kept. Otherwise (deep link or
 * reload) replace this entry with the summary.
 */
function returnToSummary() {
  const back = router.options.history.state.back
  if (typeof back === 'string') {
    const previous = router.resolve(back)
    if (previous.name === 'summary' && previous.params.id === props.id) {
      router.back()
      return
    }
  }
  void router.replace({ name: 'summary', params: { id: props.id } })
}

function save() {
  const patch = validation.value.patch
  if (!patch || saving.value) return
  saving.value = true
  store.updateSession(props.id, patch)
  returnToSummary()
}
</script>

<template>
  <section v-if="session && values" class="edit-session">
    <h2 ref="heading" tabindex="-1">Editar sesión</h2>

    <SessionForm
      v-model:values="values"
      id-prefix="es"
      :errors="validation.errors"
      :structure-locked="locked"
      submit-label="Guardar cambios"
      :submit-disabled="!validation.patch || saving"
      @submit="save"
      @cancel="returnToSummary"
    />
  </section>

  <section v-else class="not-found">
    <p>No se encontró la sesión.</p>
    <RouterLink to="/">Volver al inicio</RouterLink>
  </section>
</template>

<style scoped>
.edit-session h2 {
  margin-top: 0;
}
</style>
