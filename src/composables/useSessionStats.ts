import { computed } from 'vue'

import {
  averagePerArrow,
  endTotal,
  grandTotal as sumAll,
  maxArrowPoints,
  seriesRunningTotal,
  seriesTotal,
} from '@/domain/scoring'
import { getTargetFace } from '@/domain/targetFaces'
import { useSessionsStore } from '@/stores/sessions'

/**
 * Live totals and average of one archer of one session (CU-07). Everything is a computed
 * derived from the store; nothing is written back or persisted.
 */
export function useSessionStats(sessionId: string, archerId: string) {
  const store = useSessionsStore()

  const session = computed(() => store.getSession(sessionId))
  const ends = computed(() => store.getArcher(sessionId, archerId)?.ends ?? [])
  const face = computed(() => (session.value ? getTargetFace(session.value.faceId) : undefined))
  const endsPerSeries = computed(() => session.value?.endsPerSeries ?? 1)

  const arrowMax = computed(() => (face.value ? maxArrowPoints(face.value) : 0))
  const endMax = computed(() => (session.value?.arrowsPerEnd ?? 0) * arrowMax.value)
  const seriesMax = computed(() => (session.value?.endsPerSeries ?? 0) * endMax.value)
  const grandMax = computed(() => ends.value.length * endMax.value)

  /**
   * AC7: an unstarted end (every arrow empty) shows no total or running total, so its entry is
   * null. An end holding only misses is started and shows 0. Change only this rule if
   * ArcheryReg turns out to show 0 or the previous running total.
   */
  const isStarted = (row: number) => ends.value[row]?.some((key) => key !== null) ?? false

  /** One entry per row: the end's total, or null when unstarted. */
  const endTotals = computed(() =>
    ends.value.map((end, row) => (face.value && isStarted(row) ? endTotal(end, face.value) : null)),
  )

  /** One entry per row: the series running total up to that row, or null when unstarted. */
  const runningTotals = computed(() =>
    ends.value.map((_, row) =>
      face.value && isStarted(row)
        ? seriesRunningTotal(ends.value, row, endsPerSeries.value, face.value)
        : null,
    ),
  )

  /** One entry per series, always numeric. */
  const seriesTotals = computed(() => {
    const count = Math.ceil(ends.value.length / endsPerSeries.value)
    return Array.from({ length: count }, (_, s) =>
      face.value ? seriesTotal(ends.value, s, endsPerSeries.value, face.value) : 0,
    )
  })

  const grandTotal = computed(() => (face.value ? sumAll(ends.value, face.value) : 0))

  const average = computed(() => (face.value ? averagePerArrow(ends.value, face.value) : null))

  /** «Promedio: 8.67» (decimal point, always 2 decimals) or «Promedio: —». */
  const averageLabel = computed(() =>
    average.value === null ? 'Promedio: —' : `Promedio: ${average.value.toFixed(2)}`,
  )

  return {
    arrowMax,
    endMax,
    seriesMax,
    grandMax,
    endTotals,
    runningTotals,
    seriesTotals,
    grandTotal,
    average,
    averageLabel,
  }
}
