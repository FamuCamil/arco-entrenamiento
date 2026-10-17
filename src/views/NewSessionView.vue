<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { localIsoDate } from '@/domain/dates'
import {
  applyTemplate,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_TEMPLATE_ID,
  initialFormValues,
  validateSessionForm,
  type SessionFormField,
} from '@/domain/sessionForm'
import { TARGET_FACES } from '@/domain/targetFaces'
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

/** «Variable» blanks the distance input; unchecking it requires typing a distance. */
function onVariableChange() {
  if (values.value.variableDistance) values.value.distance = ''
  markCustom()
}

function errorOf(field: SessionFormField): string | undefined {
  return validation.value.errors[field]
}

/** aria-invalid / aria-describedby for a validated control. */
function errorAttrs(field: SessionFormField) {
  return errorOf(field)
    ? { 'aria-invalid': 'true' as const, 'aria-describedby': `ns-${field}-error` }
    : {}
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

    <form class="form" novalidate @submit.prevent="create">
      <div class="field">
        <label for="ns-date">Fecha</label>
        <input id="ns-date" v-model="values.date" type="date" v-bind="errorAttrs('date')" />
        <p v-if="errorOf('date')" id="ns-date-error" class="error">{{ errorOf('date') }}</p>
      </div>

      <div class="field">
        <label for="ns-location">Lugar (opcional)</label>
        <input id="ns-location" v-model="values.location" type="text" autocomplete="off" />
      </div>

      <div class="field">
        <label for="ns-distance">Distancia (m)</label>
        <input
          id="ns-distance"
          v-model="values.distance"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :disabled="values.variableDistance"
          v-bind="errorAttrs('distance')"
          @input="markCustom"
        />
        <label class="checkbox">
          <input v-model="values.variableDistance" type="checkbox" @change="onVariableChange" />
          Variable
        </label>
        <p v-if="errorOf('distance')" id="ns-distance-error" class="error">
          {{ errorOf('distance') }}
        </p>
      </div>

      <div class="field">
        <label for="ns-face">Diana</label>
        <select
          id="ns-face"
          v-model="values.faceId"
          v-bind="errorAttrs('faceId')"
          @change="markCustom"
        >
          <option v-for="face in TARGET_FACES" :key="face.id" :value="face.id">
            {{ face.name }}
          </option>
        </select>
        <p v-if="errorOf('faceId')" id="ns-faceId-error" class="error">{{ errorOf('faceId') }}</p>
      </div>

      <fieldset class="structure">
        <legend>Estructura</legend>
        <div class="field">
          <label for="ns-series">Series</label>
          <input
            id="ns-series"
            v-model="values.seriesCount"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            v-bind="errorAttrs('seriesCount')"
            @input="markCustom"
          />
          <p v-if="errorOf('seriesCount')" id="ns-seriesCount-error" class="error">
            {{ errorOf('seriesCount') }}
          </p>
        </div>
        <div class="field">
          <label for="ns-ends">Tandas por serie</label>
          <input
            id="ns-ends"
            v-model="values.endsPerSeries"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            v-bind="errorAttrs('endsPerSeries')"
            @input="markCustom"
          />
          <p v-if="errorOf('endsPerSeries')" id="ns-endsPerSeries-error" class="error">
            {{ errorOf('endsPerSeries') }}
          </p>
        </div>
        <div class="field">
          <label for="ns-arrows">Flechas por tanda</label>
          <input
            id="ns-arrows"
            v-model="values.arrowsPerEnd"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            v-bind="errorAttrs('arrowsPerEnd')"
            @input="markCustom"
          />
          <p v-if="errorOf('arrowsPerEnd')" id="ns-arrowsPerEnd-error" class="error">
            {{ errorOf('arrowsPerEnd') }}
          </p>
        </div>
      </fieldset>

      <div class="field">
        <label for="ns-notes">Notas (opcional)</label>
        <textarea id="ns-notes" v-model="values.notes" rows="3" />
      </div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!validation.input || submitted">
          Crear
        </button>
        <RouterLink to="/" class="secondary">Cancelar</RouterLink>
      </div>
    </form>
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

/* Single column for every field: robust to wide fallback fonts on narrow screens. */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.field > label {
  font-weight: 600;
}

input:not([type='checkbox']),
select,
textarea {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  /* Inherited 16 px also stops iOS from zooming on focus. */
  font: inherit;
}

input:disabled {
  opacity: 0.6;
}

[aria-invalid='true'] {
  border-color: var(--color-danger);
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  align-self: flex-start;
  min-height: var(--touch-min);
  cursor: pointer;
}

.checkbox input {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
}

.structure {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.structure legend {
  padding: 0 var(--space-1);
  font-weight: 700;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.875rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.primary,
.secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.primary {
  border: none;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}
</style>
