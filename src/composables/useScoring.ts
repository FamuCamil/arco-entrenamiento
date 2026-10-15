import { computed, ref, watch } from 'vue'

import { firstEmptyCell, nextCell } from '@/domain/scoring'
import { getTargetFace } from '@/domain/targetFaces'
import type { Cell } from '@/domain/types'
import { useSessionsStore } from '@/stores/sessions'

/** Scoring-screen state for one archer of one session (brief: Composable useScoring). */
export function useScoring(sessionId: string, archerId: string) {
  const store = useSessionsStore()

  const session = computed(() => store.getSession(sessionId))
  const archer = computed(() => store.getArcher(sessionId, archerId))
  const face = computed(() => (session.value ? getTargetFace(session.value.faceId) : undefined))

  /** Selected cell; starts on the first empty cell. Never persisted. */
  const selected = ref<Cell>(archer.value ? firstEmptyCell(archer.value.ends) : { row: 0, col: 0 })

  const isLocked = computed(() => session.value?.closed ?? false)

  /** Writes `key` into the selected cell and advances. At the last cell the selection stays. */
  function score(key: string): void {
    if (isLocked.value || !archer.value) return
    const { row, col } = selected.value
    store.setArrow(sessionId, archerId, row, col, key)
    selected.value = nextCell(selected.value, archer.value.ends)
  }

  /**
   * Element of the selected row, set by the grid. Each new element is scrolled into view,
   * so the active row stays visible on entry and whenever the row changes.
   */
  const activeRowRef = ref<HTMLElement | null>(null)
  watch(activeRowRef, (el) => {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  })

  return { session, archer, face, selected, isLocked, score, activeRowRef }
}
