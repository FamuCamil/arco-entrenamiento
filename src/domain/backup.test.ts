import { describe, expect, it } from 'vitest'

import { makeSession, makeState } from '../../tests/fixtures'
import {
  BACKUP_MIME,
  IMPORT_EMPTY,
  IMPORT_ERRORS,
  IMPORT_NO_CHANGES,
  backupFileName,
  importConfirmMessage,
  importSuccessMessage,
  parseBackup,
  planMerge,
  serializeBackup,
} from './backup'
import type { Session } from './types'

const NOW = new Date(Date.UTC(2026, 9, 17, 18, 30, 5, 123))

function scored(overrides: Partial<Session> = {}): Session {
  const s = makeSession(overrides)
  s.archers[0]!.ends[0] = ['X', '9', null]
  return s
}

function text(value: unknown): string {
  return JSON.stringify(value)
}

function errorOf(raw: string): string | undefined {
  const result = parseBackup(raw)
  return result.ok ? undefined : result.error
}

describe('constants', () => {
  it('uses the JSON MIME type', () => {
    expect(BACKUP_MIME).toBe('application/json')
  })

  it('has the exact Spanish notices', () => {
    expect(IMPORT_NO_CHANGES).toBe('La copia no tiene cambios: todas las sesiones ya están al día.')
    expect(IMPORT_EMPTY).toBe('La copia no contiene sesiones.')
  })
})

describe('serializeBackup', () => {
  it('writes version, sessions, profileName and exportedAt, in that order', () => {
    const state = { ...makeState([scored()]), profileName: 'Ana' }
    const parsed = JSON.parse(serializeBackup(state, NOW))
    expect(Object.keys(parsed)).toEqual(['version', 'sessions', 'profileName', 'exportedAt'])
    expect(parsed).toEqual({ ...state, exportedAt: '2026-10-17T18:30:05.123Z' })
  })

  it('is indented with 2 spaces', () => {
    const json = serializeBackup(makeState([]), NOW)
    expect(json).toBe(
      '{\n  "version": 1,\n  "sessions": [],\n  "profileName": "",\n  "exportedAt": "2026-10-17T18:30:05.123Z"\n}',
    )
  })

  it('adds nothing but exportedAt to the persisted state', () => {
    const state = makeState([scored()])
    const { exportedAt, ...rest } = JSON.parse(serializeBackup(state, NOW))
    expect(exportedAt).toBe(NOW.toISOString())
    expect(rest).toEqual(state)
  })

  it('drops extra fields of the state object', () => {
    const state = { ...makeState([]), extra: 1 } as ReturnType<typeof makeState>
    expect(JSON.parse(serializeBackup(state, NOW))).not.toHaveProperty('extra')
  })

  it('round-trips through parseBackup to identical data', () => {
    const state = {
      ...makeState([scored({ id: 'a', closed: true, updatedAt: 7 }), makeSession({ id: 'b' })]),
      profileName: 'Ana',
    }
    const result = parseBackup(serializeBackup(state, NOW))
    expect(result).toEqual({ ok: true, state })
  })
})

describe('backupFileName', () => {
  it('is arco-copia-YYYY-MM-DD.json with zero padding', () => {
    expect(backupFileName(new Date(2026, 0, 5, 12))).toBe('arco-copia-2026-01-05.json')
  })

  it('uses the local date near midnight', () => {
    expect(backupFileName(new Date(2026, 9, 17, 23, 59))).toBe('arco-copia-2026-10-17.json')
    expect(backupFileName(new Date(2026, 9, 18, 0, 1))).toBe('arco-copia-2026-10-18.json')
  })
})

describe('parseBackup', () => {
  it('accepts a valid file and drops exportedAt', () => {
    const state = makeState([scored()])
    const result = parseBackup(text({ ...state, exportedAt: NOW.toISOString() }))
    expect(result).toEqual({ ok: true, state })
    expect(result.ok && result.state).not.toHaveProperty('exportedAt')
  })

  it('accepts a raw archery-training:v1 dump without exportedAt', () => {
    const state = { ...makeState([scored()]), profileName: 'Luis' }
    expect(parseBackup(text(state))).toEqual({ ok: true, state })
  })

  it('accepts an empty copy', () => {
    expect(parseBackup(text(makeState([])))).toEqual({ ok: true, state: makeState([]) })
  })

  it('accepts an unknown faceId or zone key, exactly like load()', () => {
    const s = makeSession({ faceId: 'unknown-face' })
    s.archers[0]!.ends[0] = ['ZZ', null, null]
    expect(parseBackup(text(makeState([s]))).ok).toBe(true)
  })

  it.each(['', 'not json', '{"version":1,', 'undefined'])('rejects non-JSON (%j)', (raw) => {
    expect(errorOf(raw)).toBe(IMPORT_ERRORS.notJson)
  })

  it.each([
    ['an array', []],
    ['a string', 'hola'],
    ['a number', 1],
    ['null', null],
  ])('rejects %s as not a copy', (_label, value) => {
    expect(errorOf(text(value))).toBe(IMPORT_ERRORS.notACopy)
  })

  it.each([
    ['missing sessions', { version: 1, profileName: '' }],
    ['non-array sessions', { version: 1, sessions: {}, profileName: '' }],
    ['{version:1, data:[]}', { version: 1, data: [] }],
  ])('rejects %s as not a copy', (_label, value) => {
    expect(errorOf(text(value))).toBe(IMPORT_ERRORS.notACopy)
  })

  it('checks a newer version before the shape ({version:2, data:[]})', () => {
    expect(errorOf(text({ version: 2, data: [] }))).toBe(IMPORT_ERRORS.newerVersion)
  })

  it('rejects a newer version with a valid shape', () => {
    expect(errorOf(text({ ...makeState(), version: 2 }))).toBe(IMPORT_ERRORS.newerVersion)
  })

  it.each([
    ['version 0', 0],
    ['version "1"', '1'],
    ['version 0.5', 0.5],
    ['a missing version', undefined],
  ])('rejects %s as an unknown version', (_label, version) => {
    expect(errorOf(text({ ...makeState(), version }))).toBe(IMPORT_ERRORS.unknownVersion)
  })

  it('rejects a missing profileName as damaged', () => {
    expect(errorOf(text({ version: 1, sessions: [] }))).toBe(IMPORT_ERRORS.invalidSessions)
  })

  it.each([
    [
      'a missing field',
      () => {
        const s: Partial<Session> = makeSession()
        delete s.notes
        return s
      },
    ],
    ['a wrong type', () => ({ ...makeSession(), distance: '18' })],
    ['a non-boolean closed', () => ({ ...makeSession(), closed: 'no' })],
    ['a negative updatedAt', () => ({ ...makeSession(), updatedAt: -1 })],
    [
      'ends length ≠ rows',
      () => {
        const s = makeSession()
        s.archers[0]!.ends.pop()
        return s
      },
    ],
    [
      'end length ≠ arrowsPerEnd',
      () => {
        const s = makeSession()
        s.archers[0]!.ends[3] = [null, null, null, null]
        return s
      },
    ],
    [
      'a numeric zone key',
      () => {
        const s = makeSession()
        ;(s.archers[0]!.ends[0] as unknown[])[0] = 10
        return s
      },
    ],
    ['empty archers', () => ({ ...makeSession(), archers: [] })],
    ['a non-object session', () => 'session'],
  ])('rejects %s in any session as damaged, all or nothing', (_label, build) => {
    const raw = text(makeState([makeSession({ id: 'ok' }), build() as Session]))
    expect(errorOf(raw)).toBe(IMPORT_ERRORS.invalidSessions)
  })

  it('rejects duplicate session ids', () => {
    const raw = text(makeState([makeSession({ id: 'x' }), makeSession({ id: 'x', updatedAt: 9 })]))
    expect(errorOf(raw)).toBe(IMPORT_ERRORS.duplicateIds)
  })

  it('has Spanish messages for every error', () => {
    expect(IMPORT_ERRORS).toEqual({
      notJson: 'El archivo no es una copia válida: no contiene JSON.',
      notACopy: 'El archivo no es una copia de Arco · Entrenamientos.',
      newerVersion:
        'La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.',
      unknownVersion: 'La copia tiene una versión desconocida.',
      invalidSessions: 'La copia tiene sesiones dañadas o incompletas. No se ha importado nada.',
      duplicateIds: 'La copia tiene sesiones repetidas. No se ha importado nada.',
    })
  })
})

describe('planMerge', () => {
  it('adds unknown ids at the end, in file order', () => {
    const local = [makeSession({ id: 'a' })]
    const incoming = [makeSession({ id: 'c' }), makeSession({ id: 'b' })]
    const plan = planMerge(local, incoming)
    expect(plan.sessions.map((s) => s.id)).toEqual(['a', 'c', 'b'])
    expect(plan.sessions[1]).toBe(incoming[0])
    expect(plan).toMatchObject({ added: 2, updated: 0, unchanged: 0 })
  })

  it('replaces a local session with a strictly newer one, in place', () => {
    const local = [makeSession({ id: 'a' }), makeSession({ id: 'b', updatedAt: 5 })]
    const newer = scored({ id: 'b', updatedAt: 6 })
    const plan = planMerge(local, [newer])
    expect(plan.sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(plan.sessions[1]).toBe(newer)
    expect(plan).toMatchObject({ added: 0, updated: 1, unchanged: 0 })
  })

  it('keeps the local session on a tie even if the content differs', () => {
    const local = [makeSession({ id: 'a', updatedAt: 5 })]
    const plan = planMerge(local, [scored({ id: 'a', updatedAt: 5 })])
    expect(plan.sessions[0]).toBe(local[0])
    expect(plan).toMatchObject({ added: 0, updated: 0, unchanged: 1 })
  })

  it('keeps the local session when the incoming one is older', () => {
    const local = [scored({ id: 'a', updatedAt: 9 })]
    const plan = planMerge(local, [makeSession({ id: 'a', updatedAt: 2 })])
    expect(plan.sessions[0]).toBe(local[0])
    expect(plan).toMatchObject({ added: 0, updated: 0, unchanged: 1 })
  })

  it('keeps local-only sessions', () => {
    const local = [makeSession({ id: 'a' }), makeSession({ id: 'b' })]
    const plan = planMerge(local, [makeSession({ id: 'b' })])
    expect(plan.sessions).toEqual(local)
    expect(plan.sessions[0]).toBe(local[0])
    expect(plan).toMatchObject({ added: 0, updated: 0, unchanged: 1 })
  })

  it('counts a mixed file', () => {
    const local = [
      makeSession({ id: 'same', updatedAt: 3 }),
      makeSession({ id: 'old', updatedAt: 3 }),
      makeSession({ id: 'mine' }),
    ]
    const incoming = [
      makeSession({ id: 'same', updatedAt: 3 }),
      makeSession({ id: 'old', updatedAt: 4 }),
      makeSession({ id: 'new1' }),
      makeSession({ id: 'new2' }),
    ]
    const plan = planMerge(local, incoming)
    expect(plan.sessions.map((s) => s.id)).toEqual(['same', 'old', 'mine', 'new1', 'new2'])
    expect(plan).toMatchObject({ added: 2, updated: 1, unchanged: 1 })
  })

  it('does not mutate its inputs', () => {
    const local = [makeSession({ id: 'a', updatedAt: 1 })]
    const incoming = [scored({ id: 'a', updatedAt: 2 }), makeSession({ id: 'b' })]
    const localCopy = structuredClone(local)
    const incomingCopy = structuredClone(incoming)
    planMerge(local, incoming)
    expect(local).toEqual(localCopy)
    expect(incoming).toEqual(incomingCopy)
    expect(local).toHaveLength(1)
  })

  it('is idempotent: merging the same file again changes nothing', () => {
    const incoming = [scored({ id: 'a', updatedAt: 9 }), makeSession({ id: 'b' })]
    const first = planMerge([makeSession({ id: 'a', updatedAt: 1 })], incoming)
    const second = planMerge(first.sessions, incoming)
    expect(second.sessions).toEqual(first.sessions)
    expect(second.sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(second).toMatchObject({ added: 0, updated: 0, unchanged: 2 })
  })

  it('keeps closed, createdAt and updatedAt of imported sessions as they came', () => {
    const added = makeSession({ id: 'n', closed: true, createdAt: 11, updatedAt: 22 })
    const updated = makeSession({ id: 'u', closed: true, createdAt: 3, updatedAt: 44 })
    const plan = planMerge([makeSession({ id: 'u', createdAt: 1, updatedAt: 2 })], [updated, added])
    expect(
      plan.sessions.map(({ id, closed, createdAt, updatedAt }) => [
        id,
        closed,
        createdAt,
        updatedAt,
      ]),
    ).toEqual([
      ['u', true, 3, 44],
      ['n', true, 11, 22],
    ])
  })

  it('handles empty inputs', () => {
    expect(planMerge([], [])).toEqual({ sessions: [], added: 0, updated: 0, unchanged: 0 })
  })
})

describe('importConfirmMessage', () => {
  it('matches the AC example', () => {
    expect(importConfirmMessage({ added: 3, updated: 1, unchanged: 5 })).toBe(
      'Se añadirán 3 sesiones y se actualizará 1. 5 ya están al día.',
    )
  })

  it.each([
    [{ added: 1, updated: 0, unchanged: 0 }, 'Se añadirá 1 sesión.'],
    [{ added: 2, updated: 0, unchanged: 0 }, 'Se añadirán 2 sesiones.'],
    [
      { added: 1, updated: 1, unchanged: 1 },
      'Se añadirá 1 sesión y se actualizará 1. 1 ya está al día.',
    ],
    [{ added: 2, updated: 3, unchanged: 0 }, 'Se añadirán 2 sesiones y se actualizarán 3.'],
    [{ added: 0, updated: 1, unchanged: 0 }, 'Se actualizará 1 sesión.'],
    [{ added: 0, updated: 4, unchanged: 2 }, 'Se actualizarán 4 sesiones. 2 ya están al día.'],
  ])('%j → %s', (counts, message) => {
    expect(importConfirmMessage(counts)).toBe(message)
  })
})

describe('importSuccessMessage', () => {
  it.each([
    [
      { added: 1, updated: 1, unchanged: 1 },
      'Copia importada: 1 sesión añadida, 1 actualizada y 1 sin cambios.',
    ],
    [
      { added: 2, updated: 3, unchanged: 4 },
      'Copia importada: 2 sesiones añadidas, 3 actualizadas y 4 sin cambios.',
    ],
    [
      { added: 0, updated: 0, unchanged: 0 },
      'Copia importada: 0 sesiones añadidas, 0 actualizadas y 0 sin cambios.',
    ],
  ])('%j → %s', (counts, message) => {
    expect(importSuccessMessage(counts)).toBe(message)
  })
})
