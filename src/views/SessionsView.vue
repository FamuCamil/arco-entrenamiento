<script setup lang="ts">
// Home: session cards, most recent first (CU-09), and the backup export/import (CU-11).
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import SessionCard from '@/components/SessionCard.vue'
import { useConfirm } from '@/composables/useConfirm'
import {
  BACKUP_MIME,
  IMPORT_EMPTY,
  IMPORT_NO_CHANGES,
  backupFileName,
  importConfirmMessage,
  importSuccessMessage,
} from '@/domain/backup'
import { useSessionsStore } from '@/stores/sessions'

const router = useRouter()
const store = useSessionsStore()
const { confirm } = useConfirm()

/** Sessions without an archer (defensive; shouldn't exist) have nothing to open, so no card. */
const listedSessions = computed(() =>
  store.sortedSessions.filter((session) => session.archers[0] !== undefined),
)

function newSession() {
  void router.push({ name: 'new-session' })
}

type NoticeKind = 'success' | 'info' | 'error'

const EXPORT_ERROR = 'No se pudo exportar la copia.'
const READ_ERROR = 'No se pudo leer el archivo.'
const SAVE_ERROR =
  'Las sesiones se han importado, pero no se pudieron guardar en el dispositivo. Podrían perderse al cerrar la app.'
const SHARE_TITLE = 'Copia de seguridad de Arco · Entrenamientos'

const exportButton = ref<HTMLButtonElement | null>(null)
const importButton = ref<HTMLButtonElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const notice = ref<{ kind: NoticeKind; text: string } | null>(null)

/** Nothing to back up with zero sessions (AC5): aria-disabled keeps the button focusable. */
const canExport = computed(() => store.sessions.length > 0)

function showNotice(kind: NoticeKind, text: string) {
  notice.value = { kind, text }
}

function clearNotice() {
  notice.value = null
}

onBeforeUnmount(clearNotice)

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked late: Safari may still be reading the blob right after the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    )
  } catch {
    return false
  }
}

/**
 * Shares the file where the system share sheet supports files (iOS), else downloads it. Kept
 * synchronous up to share(): any await before it would lose the user gesture.
 */
function onExport() {
  if (!canExport.value) return
  clearNotice()
  try {
    const now = new Date()
    const file = new File([store.exportJson(now)], backupFileName(now), { type: BACKUP_MIME })
    if (canShareFile(file)) {
      navigator.share({ files: [file], title: SHARE_TITLE }).catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        try {
          downloadFile(file)
        } catch {
          showNotice('error', EXPORT_ERROR)
        }
      })
    } else {
      downloadFile(file)
    }
  } catch {
    showNotice('error', EXPORT_ERROR)
  }
}

function onImportClick() {
  clearNotice()
  fileInput.value?.click()
}

/** Validated by content, never by MIME type. Nothing changes until the user confirms. */
async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so choosing the same file again still fires change.
  input.value = ''
  if (!file) return
  let text: string
  try {
    text = await file.text()
  } catch {
    showNotice('error', READ_ERROR)
    return
  }
  const preview = store.importJson(text)
  if (!preview.ok) {
    showNotice('error', preview.error)
    return
  }
  if (preview.total === 0 || preview.added + preview.updated === 0) {
    // Nothing to confirm; apply() may still adopt the profile name.
    const result = preview.apply()
    if (result.saved) showNotice('info', preview.total === 0 ? IMPORT_EMPTY : IMPORT_NO_CHANGES)
    else showNotice('error', SAVE_ERROR)
    return
  }
  const ok = await confirm({
    title: '¿Importar copia?',
    message: importConfirmMessage(preview),
    confirmLabel: 'Importar',
    cancelLabel: 'Cancelar',
    danger: false,
    returnFocusTo: importButton.value ?? undefined,
  })
  if (!ok) return
  const result = preview.apply()
  if (result.saved) showNotice('success', importSuccessMessage(result))
  else showNotice('error', SAVE_ERROR)
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

    <section class="backup" aria-labelledby="backup-title" data-testid="backup-section">
      <h3 id="backup-title">Copia de seguridad</h3>
      <div class="backup-actions">
        <button
          ref="exportButton"
          type="button"
          class="backup-button"
          data-testid="export-backup"
          :aria-disabled="canExport ? undefined : 'true'"
          @click="onExport"
        >
          Exportar copia
        </button>
        <button
          ref="importButton"
          type="button"
          class="backup-button"
          data-testid="import-backup"
          @click="onImportClick"
        >
          Importar copia
        </button>
      </div>
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="application/json,.json"
        tabindex="-1"
        aria-hidden="true"
        data-testid="import-input"
        @change="onFileChosen"
      />
      <!-- Live regions stay mounted so screen readers announce the notice inserted inside. -->
      <div class="notice-region" role="status" aria-live="polite" data-testid="backup-status">
        <div
          v-if="notice && notice.kind !== 'error'"
          :class="['notice', `notice-${notice.kind}`]"
          data-testid="backup-notice"
        >
          <p>{{ notice.text }}</p>
          <button
            type="button"
            class="notice-close"
            aria-label="Cerrar aviso"
            data-testid="backup-notice-close"
            @click="clearNotice"
          >
            ×
          </button>
        </div>
      </div>
      <div class="notice-region" role="alert" data-testid="backup-alert">
        <div
          v-if="notice && notice.kind === 'error'"
          class="notice notice-error"
          data-testid="backup-notice"
        >
          <p>{{ notice.text }}</p>
          <button
            type="button"
            class="notice-close"
            aria-label="Cerrar aviso"
            data-testid="backup-notice-close"
            @click="clearNotice"
          >
            ×
          </button>
        </div>
      </div>
    </section>
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

.backup {
  position: relative;
  margin-top: var(--space-6);
}

.backup h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-base);
}

.backup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

/* Outlined accent, like «Finalizar sesión». */
.backup-button {
  min-width: 0;
  min-height: var(--touch-min);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-accent);
  font: inherit;
  font-weight: 600;
  white-space: normal;
  cursor: pointer;
  touch-action: manipulation;
}

.backup-button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Visually hidden but clickable from script (display:none is unreliable on some browsers). */
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  clip-path: inset(50%);
  pointer-events: none;
}

.notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-left: var(--space-3);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
}

.notice-error {
  border-left-color: var(--color-danger);
}

.notice p {
  flex: 1;
  min-width: 0;
  margin: var(--space-2) 0;
  overflow-wrap: anywhere;
}

.notice-close {
  flex: none;
  width: var(--touch-min);
  height: var(--touch-min);
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-lg);
  cursor: pointer;
  touch-action: manipulation;
}
</style>
