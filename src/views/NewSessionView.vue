<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import SessionForm from '@/components/SessionForm.vue'
import { localIsoDate } from '@/domain/dates'
import {
  applyTemplate,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_TEMPLATE_ID,
  initialFormValues,
  validateSessionForm,
} from '@/domain/sessionForm'
import { SESSION_TEMPLATES, type SessionTemplate } from '@/domain/templates'
import { useSessionsStore } from '@/stores/sessions'

const router = useRouter()
const store = useSessionsStore()

const values = ref(initialFormValues(localIsoDate()))
const selectedTemplateId = ref(DEFAULT_TEMPLATE_ID)
const validation = computed(() => validateSessionForm(values.value))
const submitted = ref(false)

function chooseTemplate(template: SessionTemplate) {
  values.value = applyTemplate(values.value, template)
  selectedTemplateId.value = template.id
}

// AC6: editing a preset-controlled field keeps the edit and marks the form as custom. Templates
// are only applied by an explicit tap, never re-applied by themselves.
function markCustom() {
  selectedTemplateId.value = CUSTOM_TEMPLATE_ID
}

function create() {
  const input = validation.value.input
  if (!input || submitted.value) return
  submitted.value = true
  const session = store.createSession(input)
  const archer = session.archers[0]
  if (!archer) return
  // Replace: Back from scoring goes home, not to a stale form that could create a duplicate.
  void router.replace({ name: 'scoring', params: { id: session.id, archerId: archer.id } })
}
</script>

<template>
  <section class="new-session">
    <h2>Nueva sesión</h2>

    <div role="group" aria-label="Plantillas" class="templates">
      <button
        v-for="template in SESSION_TEMPLATES"
        :key="template.id"
        type="button"
        class="template"
        :aria-pressed="selectedTemplateId === template.id"
        @click="chooseTemplate(template)"
      >
        {{ template.label }}
      </button>
    </div>

    <SessionForm
      v-model:values="values"
      id-prefix="ns"
      :errors="validation.errors"
      submit-label="Crear"
      :submit-disabled="!validation.input || submitted"
      cancel-to="/"
      @submit="create"
      @preset-edit="markCustom"
    />
  </section>
</template>

<style scoped>
.new-session h2 {
  margin-top: 0;
}

/* Two columns at 375 px; long labels («Aire libre 50 m compuesto») wrap onto two lines. */
.templates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.template {
  min-height: var(--touch-min);
  min-width: 0;
  padding: var(--space-2);
  border: 2px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.template[aria-pressed='true'] {
  border-color: var(--color-selected-border);
  background: var(--color-selected-bg);
  font-weight: 600;
}
</style>
