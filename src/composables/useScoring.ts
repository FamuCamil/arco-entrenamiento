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

  /**
   * Selects any cell, filled or empty (CU-04): the next key press writes or overwrites it.
   * No-op when the session is closed, the archer is missing, or (row, col) is out of range.
   */
  function select(row: number, col: number): void {
    if (isLocked.value || !archer.value) return
    const end = Number.isInteger(row) ? archer.value.ends[row] : undefined
    if (!end || !Number.isInteger(col) || col < 0 || col >= end.length) return
    selected.value = { row, col }
  }

  /** Writes `key` into the selected cell and advances. At the last cell the selection stays. */
  function score(key: string): void {
    if (isLocked.value || !archer.value) return
    const { row, col } = selected.value
    store.setArrow(sessionId, archerId, row, col, key)
    // Advance from the touched cell even if CU-06 sorting moved its value.
    selected.value = nextCell(selected.value, archer.value.ends)
  }

  /** True when the selected cell holds a value that «Borrar flecha» can clear. */
  const canDeleteArrow = computed(() => {
    if (isLocked.value || !archer.value) return false
    const { row, col } = selected.value
    return (archer.value.ends[row]?.[col] ?? null) !== null
  })

  /** True when the selected cell's end holds at least one value that «Borrar tanda» can clear. */
  const canDeleteEnd = computed(() => {
    if (isLocked.value || !archer.value) return false
    return archer.value.ends[selected.value.row]?.some((v) => v !== null) ?? false
  })

  /** Empties the selected cell (CU-05). The selection stays so the right value can be scored. */
  function deleteArrow(): void {
    if (!canDeleteArrow.value) return
    const { row, col } = selected.value
    store.setArrow(sessionId, archerId, row, col, null)
  }

  /**
   * Empties the selected cell's end and selects its first arrow (CU-05).
   * Confirmation is the caller's job.
   */
  function deleteEnd(): void {
    if (!canDeleteEnd.value) return
    const { row } = selected.value
    store.deleteEnd(sessionId, archerId, row)
    selected.value = { row, col: 0 }
  }

  /**
   * Element of the selected row, set by the grid. Each new element is scrolled into view,
   * so the active row stays visible on entry and whenever the row changes.
   */
  const activeRowRef = ref<HTMLElement | null>(null)
  watch(activeRowRef, (el) => {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  })

  return {
    session,
    archer,
    face,
    selected,
    isLocked,
    select,
    score,
    canDeleteArrow,
    canDeleteEnd,
    deleteArrow,
    deleteEnd,
    activeRowRef,
  }
}
