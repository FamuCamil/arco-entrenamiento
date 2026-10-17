<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import {
  STRUCTURE_LOCKED_MESSAGE,
  type SessionFormErrors,
  type SessionFormField,
  type SessionFormValues,
} from '@/domain/sessionForm'
import { TARGET_FACES } from '@/domain/targetFaces'

// Session form fields shared by «Nueva sesión» (CU-01/02) and «Editar sesión» (CU-11).
// The views own the values' origin, the validation and what submit does.
const values = defineModel<SessionFormValues>('values', { required: true })

const props = withDefaults(
  defineProps<{
    /** Prefix of every control and error id: `${idPrefix}-date`, `${idPrefix}-date-error`. */
    idPrefix: string
    errors: SessionFormErrors
    /** Face and structure disabled with an explanation (the session already has arrows). */
    structureLocked?: boolean
    submitLabel: string
    submitDisabled: boolean
    /** Cancel as a link to this route; without it, a button that emits `cancel`. */
    cancelTo?: RouteLocationRaw
  }>(),
  { structureLocked: false, cancelTo: undefined },
)

const emit = defineEmits<{
  submit: []
  cancel: []
  /** A preset-controlled field was edited (distance, Variable, face or structure). */
  'preset-edit': []
}>()

const lockedHintId = computed(() => `${props.idPrefix}-structure-locked`)

/** A stored face outside the catalogue gets its own option instead of a blank select. */
const unknownFaceId = computed(() =>
  values.value.faceId !== '' && !TARGET_FACES.some((face) => face.id === values.value.faceId)
    ? values.value.faceId
    : undefined,
)

function controlId(name: string): string {
  return `${props.idPrefix}-${name}`
}

function errorId(field: SessionFormField): string {
  return `${props.idPrefix}-${field}-error`
}

function errorOf(field: SessionFormField): string | undefined {
  return props.errors[field]
}

/** aria-invalid / aria-describedby for a validated control; locked ones also cite the hint. */
function controlAttrs(field: SessionFormField, lockable = false) {
  const describedBy = [
    lockable && props.structureLocked ? lockedHintId.value : undefined,
    errorOf(field) ? errorId(field) : undefined,
  ].filter((id): id is string => id !== undefined)
  return {
    ...(errorOf(field) ? { 'aria-invalid': 'true' as const } : {}),
    ...(describedBy.length > 0 ? { 'aria-describedby': describedBy.join(' ') } : {}),
  }
}

/** «Variable» blanks the distance input; unchecking it requires typing a distance. */
function onVariableChange() {
  if (values.value.variableDistance) values.value.distance = ''
  emit('preset-edit')
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="emit('submit')">
    <div class="field">
      <label :for="controlId('date')">Fecha</label>
      <input
        :id="controlId('date')"
        v-model="values.date"
        type="date"
        v-bind="controlAttrs('date')"
      />
      <p v-if="errorOf('date')" :id="errorId('date')" class="error">{{ errorOf('date') }}</p>
    </div>

    <div class="field">
      <label :for="controlId('location')">Lugar (opcional)</label>
      <input :id="controlId('location')" v-model="values.location" type="text" autocomplete="off" />
    </div>

    <div class="field">
      <label :for="controlId('distance')">Distancia (m)</label>
      <input
        :id="controlId('distance')"
        v-model="values.distance"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :disabled="values.variableDistance"
        v-bind="controlAttrs('distance')"
        @input="emit('preset-edit')"
      />
      <label class="checkbox">
        <input v-model="values.variableDistance" type="checkbox" @change="onVariableChange" />
        Variable
      </label>
      <p v-if="errorOf('distance')" :id="errorId('distance')" class="error">
        {{ errorOf('distance') }}
      </p>
    </div>

    <p v-if="structureLocked" :id="lockedHintId" class="hint" data-testid="structure-locked">
      {{ STRUCTURE_LOCKED_MESSAGE }}
    </p>

    <div class="field">
      <label :for="controlId('face')">Diana</label>
      <select
        :id="controlId('face')"
        v-model="values.faceId"
        :disabled="structureLocked"
        v-bind="controlAttrs('faceId', true)"
        @change="emit('preset-edit')"
      >
        <option v-if="unknownFaceId !== undefined" :value="unknownFaceId">Diana desconocida</option>
        <option v-for="face in TARGET_FACES" :key="face.id" :value="face.id">
          {{ face.name }}
        </option>
      </select>
      <p v-if="errorOf('faceId')" :id="errorId('faceId')" class="error">
        {{ errorOf('faceId') }}
      </p>
    </div>

    <fieldset class="structure">
      <legend>Estructura</legend>
      <div class="field">
        <label :for="controlId('series')">Series</label>
        <input
          :id="controlId('series')"
          v-model="values.seriesCount"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :disabled="structureLocked"
          v-bind="controlAttrs('seriesCount', true)"
          @input="emit('preset-edit')"
        />
        <p v-if="errorOf('seriesCount')" :id="errorId('seriesCount')" class="error">
          {{ errorOf('seriesCount') }}
        </p>
      </div>
      <div class="field">
        <label :for="controlId('ends')">Tandas por serie</label>
        <input
          :id="controlId('ends')"
          v-model="values.endsPerSeries"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :disabled="structureLocked"
          v-bind="controlAttrs('endsPerSeries', true)"
          @input="emit('preset-edit')"
        />
        <p v-if="errorOf('endsPerSeries')" :id="errorId('endsPerSeries')" class="error">
          {{ errorOf('endsPerSeries') }}
        </p>
      </div>
      <div class="field">
        <label :for="controlId('arrows')">Flechas por tanda</label>
        <input
          :id="controlId('arrows')"
          v-model="values.arrowsPerEnd"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :disabled="structureLocked"
          v-bind="controlAttrs('arrowsPerEnd', true)"
          @input="emit('preset-edit')"
        />
        <p v-if="errorOf('arrowsPerEnd')" :id="errorId('arrowsPerEnd')" class="error">
          {{ errorOf('arrowsPerEnd') }}
        </p>
      </div>
    </fieldset>

    <div class="field">
      <label :for="controlId('notes')">Notas (opcional)</label>
      <textarea :id="controlId('notes')" v-model="values.notes" rows="3" />
    </div>

    <div class="actions">
      <button type="submit" class="primary" :disabled="submitDisabled">
        {{ submitLabel }}
      </button>
      <RouterLink v-if="cancelTo !== undefined" :to="cancelTo" class="secondary">
        Cancelar
      </RouterLink>
      <button v-else type="button" class="secondary" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>

<style scoped>
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

input:disabled,
select:disabled {
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

/* The lock explanation wraps at 375 px and with wide fallback fonts. */
.hint {
  min-width: 0;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
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
