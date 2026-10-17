<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import SessionForm from '@/components/SessionForm.vue'
import { useConfirm } from '@/composables/useConfirm'
import { formatDisplayDate } from '@/domain/dates'
import { hasAnyArrow } from '@/domain/scoring'
import { sessionToFormValues, validateSessionEdit } from '@/domain/sessionForm'
import { useSessionsStore } from '@/stores/sessions'

// Edits a session's data (CU-11). Face and structure are locked once any arrow is scored.
const props = defineProps<{ id: string }>()

const router = useRouter()
const store = useSessionsStore()
const { confirm } = useConfirm()

const session = computed(() => store.getSession(props.id))
// Read once: App.vue keys views by path, so returning to this screen mounts a fresh form.
const values = ref(session.value ? sessionToFormValues(session.value) : null)
const locked = computed(() => (session.value ? hasAnyArrow(session.value.archers) : false))
const validation = computed(() =>
  values.value ? validateSessionEdit(values.value, locked.value) : { errors: {}, patch: null },
)
const saving = ref(false)
const deleting = ref(false)

const heading = ref<HTMLElement | null>(null)
const deleteButton = ref<HTMLButtonElement | null>(null)

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
  if (!patch || saving.value || deleting.value) return
  saving.value = true
  store.updateSession(props.id, patch)
  returnToSummary()
}

/** A stray tap on the form's «Cancelar» must not race the navigation home. */
function cancel() {
  if (deleting.value) return
  returnToSummary()
}

/**
 * Asks before deleting the session (CU-12); unsaved form changes are discarded, never saved. On
 * confirm it replaces this entry with home first and deletes second, so this view unmounts while
 * the session still exists and never flashes «No se encontró la sesión.».
 */
async function confirmDelete() {
  if (!session.value || deleting.value || saving.value) return
  const date = session.value.date
  const ok = await confirm({
    title: '¿Borrar la sesión?',
    message: `Se eliminarán la sesión del ${formatDisplayDate(date)} y todas sus flechas. No se puede deshacer.`,
    confirmLabel: 'Borrar',
    cancelLabel: 'Cancelar',
    danger: true,
    returnFocusTo: deleteButton.value ?? undefined,
  })
  if (!ok || deleting.value) return
  deleting.value = true
  await router.replace({ name: 'sessions', state: { sessionDeleted: true } })
  store.deleteSession(props.id)
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
      @cancel="cancel"
    />

    <section class="danger-zone" aria-label="Borrar sesión">
      <button
        ref="deleteButton"
        type="button"
        class="delete-session"
        data-testid="delete-session"
        :disabled="deleting"
        @click="confirmDelete"
      >
        Borrar sesión
      </button>
    </section>
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

.danger-zone {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Outlined danger, like «Borrar tanda». */
.delete-session {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-danger);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.delete-session:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
