import { describe, expect, it } from 'vitest'

import {
  applyTemplate,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_TEMPLATE_ID,
  initialFormValues,
  SESSION_LIMITS,
  sessionToFormValues,
  STRUCTURE_LOCKED_MESSAGE,
  validateSessionEdit,
  validateSessionForm,
  type SessionFormValues,
} from './sessionForm'
import { getTemplate } from './templates'
import { makeSession } from '../../tests/fixtures'

const VALID: SessionFormValues = {
  date: '2026-10-17',
  location: 'Club',
  variableDistance: false,
  distance: '18',
  faceId: 'wa-40',
  seriesCount: '2',
  endsPerSeries: '10',
  arrowsPerEnd: '3',
  notes: '',
}

function form(overrides: Partial<SessionFormValues> = {}): SessionFormValues {
  return { ...VALID, ...overrides }
}

function template(id: string) {
  const t = getTemplate(id)
  if (!t) throw new Error(`no template ${id}`)
  return t
}

describe('constants', () => {
  it('defaults to Sala 18 m and names Personalizada as the custom template', () => {
    expect(DEFAULT_TEMPLATE_ID).toBe('sala-18')
    expect(CUSTOM_TEMPLATE_ID).toBe('personalizada')
    expect(getTemplate(CUSTOM_TEMPLATE_ID)!.preset).toBeNull()
  })

  it('caps series at 20, ends at 30 and arrows at 12', () => {
    expect(SESSION_LIMITS).toEqual({
      seriesCount: { min: 1, max: 20 },
      endsPerSeries: { min: 1, max: 30 },
      arrowsPerEnd: { min: 1, max: 12 },
    })
  })
})

describe('initialFormValues', () => {
  it('is Sala 18 m (18 m, WA 40, 2 × 10 × 3) on the given date with empty location and notes', () => {
    expect(initialFormValues('2026-10-17')).toEqual({
      date: '2026-10-17',
      location: '',
      variableDistance: false,
      distance: '18',
      faceId: 'wa-40',
      seriesCount: '2',
      endsPerSeries: '10',
      arrowsPerEnd: '3',
      notes: '',
    })
  })

  it('is a valid form', () => {
    expect(validateSessionForm(initialFormValues('2026-10-17')).input).not.toBeNull()
  })
})

describe('applyTemplate', () => {
  const typed = form({
    date: '2026-03-01',
    location: 'Polideportivo',
    notes: 'Viento',
    distance: '5',
    faceId: 'wa-60',
    seriesCount: '7',
    endsPerSeries: '8',
    arrowsPerEnd: '9',
  })

  it('a fixed-distance preset overwrites distance, face and structure', () => {
    expect(applyTemplate(typed, template('aire-libre-70'))).toEqual({
      date: '2026-03-01',
      location: 'Polideportivo',
      notes: 'Viento',
      variableDistance: false,
      distance: '70',
      faceId: 'wa-122',
      seriesCount: '2',
      endsPerSeries: '6',
      arrowsPerEnd: '6',
    })
  })

  it('a fixed-distance preset clears a previous «Variable»', () => {
    const next = applyTemplate(form({ variableDistance: true, distance: '' }), template('sala-25'))
    expect(next.variableDistance).toBe(false)
    expect(next.distance).toBe('25')
  })

  it('Campo sets «Variable» with a blank distance', () => {
    expect(applyTemplate(typed, template('campo'))).toMatchObject({
      variableDistance: true,
      distance: '',
      faceId: 'wa-field',
      seriesCount: '2',
      endsPerSeries: '12',
      arrowsPerEnd: '3',
    })
  })

  it('3D sets «Variable» with a blank distance', () => {
    expect(applyTemplate(typed, template('3d'))).toMatchObject({
      variableDistance: true,
      distance: '',
      faceId: '3d',
      seriesCount: '2',
      endsPerSeries: '12',
      arrowsPerEnd: '2',
    })
  })

  it('keeps date, location and notes for every preset template', () => {
    for (const id of ['sala-18', 'sala-18-triple', 'aire-libre-50-compuesto', 'aire-libre-30']) {
      expect(applyTemplate(typed, template(id)), id).toMatchObject({
        date: '2026-03-01',
        location: 'Polideportivo',
        notes: 'Viento',
      })
    }
  })

  it('Personalizada returns equal values as a new object', () => {
    const next = applyTemplate(typed, template('personalizada'))
    expect(next).toEqual(typed)
    expect(next).not.toBe(typed)
  })

  it('does not mutate its input', () => {
    const before = { ...typed }
    applyTemplate(typed, template('3d'))
    expect(typed).toEqual(before)
  })
})

describe('validateSessionForm', () => {
  it('returns the SessionInput for a valid form, with no errors', () => {
    expect(validateSessionForm(form({ notes: 'Calentamiento' }))).toEqual({
      errors: {},
      input: {
        date: '2026-10-17',
        location: 'Club',
        distance: 18,
        faceId: 'wa-40',
        seriesCount: 2,
        endsPerSeries: 10,
        arrowsPerEnd: 3,
        notes: 'Calentamiento',
      },
    })
  })

  it('trims location and notes; both are optional', () => {
    expect(
      validateSessionForm(form({ location: '  Club  ', notes: '\n nota \t' })).input,
    ).toMatchObject({ location: 'Club', notes: 'nota' })
    expect(validateSessionForm(form({ location: '   ', notes: '' })).input).toMatchObject({
      location: '',
      notes: '',
    })
  })

  it('input is null whenever there is any error', () => {
    const result = validateSessionForm(form({ arrowsPerEnd: '13' }))
    expect(result.input).toBeNull()
    expect(Object.keys(result.errors)).toEqual(['arrowsPerEnd'])
  })

  it('reports every invalid field at once', () => {
    const result = validateSessionForm({
      date: '',
      location: '',
      variableDistance: false,
      distance: '',
      faceId: '',
      seriesCount: '',
      endsPerSeries: '',
      arrowsPerEnd: '',
      notes: '',
    })
    expect(result.input).toBeNull()
    expect(result.errors).toEqual({
      date: 'Fecha no válida',
      distance: 'Indica los metros o marca «Variable»',
      faceId: 'Elige una diana del catálogo',
      seriesCount: 'Entre 1 y 20 series',
      endsPerSeries: 'Entre 1 y 30 tandas por serie',
      arrowsPerEnd: 'Entre 1 y 12 flechas',
    })
  })

  describe('date', () => {
    it.each([
      '',
      '2026-1-1',
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '17/10/2026',
      'abc',
    ])('rejects %j', (date) => {
      expect(validateSessionForm(form({ date })).errors.date).toBe('Fecha no válida')
    })

    it.each(['2024-02-29', '2026-12-31', '2026-01-01'])('accepts %j', (date) => {
      const result = validateSessionForm(form({ date }))
      expect(result.errors.date).toBeUndefined()
      expect(result.input!.date).toBe(date)
    })

    it('rejects 29 February in a non-leap year', () => {
      expect(validateSessionForm(form({ date: '2026-02-29' })).errors.date).toBe('Fecha no válida')
    })
  })

  describe('distance', () => {
    it('empty is invalid unless «Variable» (not treated as 0)', () => {
      expect(validateSessionForm(form({ distance: '' })).errors.distance).toBe(
        'Indica los metros o marca «Variable»',
      )
      expect(validateSessionForm(form({ distance: '   ' })).errors.distance).toBeDefined()
    })

    it.each(['1.5', '-1', 'abc', '18m', '1e2'])('rejects %j', (distance) => {
      expect(validateSessionForm(form({ distance })).errors.distance).toBeDefined()
    })

    it('typed 0 is valid and means Variable', () => {
      expect(validateSessionForm(form({ distance: '0' })).input!.distance).toBe(0)
    })

    it('accepts any whole number of meters, trimmed, with no upper bound', () => {
      expect(validateSessionForm(form({ distance: ' 70 ' })).input!.distance).toBe(70)
      expect(validateSessionForm(form({ distance: '090' })).input!.distance).toBe(90)
      expect(validateSessionForm(form({ distance: '1000' })).input!.distance).toBe(1000)
    })

    it('«Variable» stores 0 and ignores whatever text is in the input', () => {
      for (const distance of ['', 'abc', '70']) {
        const result = validateSessionForm(form({ variableDistance: true, distance }))
        expect(result.errors.distance, distance).toBeUndefined()
        expect(result.input!.distance, distance).toBe(0)
      }
    })
  })

  describe('face', () => {
    it('rejects an id outside the catalog', () => {
      expect(validateSessionForm(form({ faceId: 'wa-999' })).errors.faceId).toBe(
        'Elige una diana del catálogo',
      )
      expect(validateSessionForm(form({ faceId: '' })).errors.faceId).toBeDefined()
    })

    it.each(['wa-122', 'wa-80', 'wa-80-6', 'wa-60', 'wa-40', 'wa-40-triple', 'wa-field', '3d'])(
      'accepts catalog face %s',
      (faceId) => {
        expect(validateSessionForm(form({ faceId })).input!.faceId).toBe(faceId)
      },
    )
  })

  describe('structure', () => {
    it.each([
      ['arrowsPerEnd', '0', false],
      ['arrowsPerEnd', '1', true],
      ['arrowsPerEnd', '12', true],
      ['arrowsPerEnd', '13', false],
      ['seriesCount', '0', false],
      ['seriesCount', '1', true],
      ['seriesCount', '20', true],
      ['seriesCount', '21', false],
      ['endsPerSeries', '0', false],
      ['endsPerSeries', '1', true],
      ['endsPerSeries', '30', true],
      ['endsPerSeries', '31', false],
    ] as const)('%s = %s → valid: %s', (field, value, valid) => {
      const result = validateSessionForm(form({ [field]: value }))
      if (valid) {
        expect(result.errors[field]).toBeUndefined()
        expect(result.input![field]).toBe(Number(value))
      } else {
        expect(result.errors[field]).toBeDefined()
        expect(result.input).toBeNull()
      }
    })

    it.each(['', '  ', '1.5', '-1', 'abc', '3 4', '+3'])(
      'rejects %j in every structure field',
      (value) => {
        for (const field of ['seriesCount', 'endsPerSeries', 'arrowsPerEnd'] as const) {
          expect(validateSessionForm(form({ [field]: value })).errors[field], field).toBeDefined()
        }
      },
    )

    it('accepts leading zeros and surrounding spaces', () => {
      expect(
        validateSessionForm(form({ seriesCount: '03', endsPerSeries: ' 6 ', arrowsPerEnd: '012' }))
          .input,
      ).toMatchObject({ seriesCount: 3, endsPerSeries: 6, arrowsPerEnd: 12 })
    })

    it('messages state the limits', () => {
      const { errors } = validateSessionForm(
        form({ seriesCount: '21', endsPerSeries: '31', arrowsPerEnd: '13' }),
      )
      expect(errors.seriesCount).toBe(
        `Entre ${SESSION_LIMITS.seriesCount.min} y ${SESSION_LIMITS.seriesCount.max} series`,
      )
      expect(errors.endsPerSeries).toBe(
        `Entre ${SESSION_LIMITS.endsPerSeries.min} y ${SESSION_LIMITS.endsPerSeries.max} tandas por serie`,
      )
      expect(errors.arrowsPerEnd).toBe('Entre 1 y 12 flechas')
    })

    it('accepts the largest grid, 20 × 30 × 12', () => {
      expect(
        validateSessionForm(form({ seriesCount: '20', endsPerSeries: '30', arrowsPerEnd: '12' }))
          .input,
      ).toMatchObject({ seriesCount: 20, endsPerSeries: 30, arrowsPerEnd: 12 })
    })
  })

  it('every preset template yields a valid form', () => {
    for (const id of [
      'sala-18',
      'sala-18-triple',
      'sala-25',
      'aire-libre-70',
      'aire-libre-50-compuesto',
      'aire-libre-30',
      'campo',
      '3d',
    ]) {
      expect(validateSessionForm(applyTemplate(VALID, template(id))).input, id).not.toBeNull()
    }
  })
})

describe('STRUCTURE_LOCKED_MESSAGE (CU-11)', () => {
  it('is the use case text', () => {
    expect(STRUCTURE_LOCKED_MESSAGE).toBe(
      'La diana y la estructura no se pueden cambiar porque la sesión ya tiene flechas anotadas.',
    )
  })
})

describe('sessionToFormValues (CU-11)', () => {
  it('maps every field of a normal session to raw strings', () => {
    expect(sessionToFormValues(makeSession({ notes: 'Viento' }))).toEqual({
      date: '2026-10-15',
      location: 'Club',
      variableDistance: false,
      distance: '18',
      faceId: 'wa-40',
      seriesCount: '2',
      endsPerSeries: '10',
      arrowsPerEnd: '3',
      notes: 'Viento',
    })
  })

  it('distance 0 checks «Variable» and leaves the distance blank', () => {
    const values = sessionToFormValues(makeSession({ distance: 0 }))
    expect(values.variableDistance).toBe(true)
    expect(values.distance).toBe('')
  })

  it('keeps legacy over-limit structure and a non-integer distance as stored', () => {
    const values = sessionToFormValues(
      makeSession({ seriesCount: 25, endsPerSeries: 40, arrowsPerEnd: 13, distance: 18.5 }),
    )
    expect(values).toMatchObject({
      seriesCount: '25',
      endsPerSeries: '40',
      arrowsPerEnd: '13',
      distance: '18.5',
      variableDistance: false,
    })
  })

  it('keeps an unknown faceId, raw place and multi-line notes untouched', () => {
    const values = sessionToFormValues(
      makeSession({ faceId: 'missing-face', location: '  Club  ', notes: 'Línea 1\nLínea 2' }),
    )
    expect(values.faceId).toBe('missing-face')
    expect(values.location).toBe('  Club  ')
    expect(values.notes).toBe('Línea 1\nLínea 2')
  })

  it('round-trips: a stored valid session validates back to its own values', () => {
    const session = makeSession({ notes: 'n' })
    expect(validateSessionEdit(sessionToFormValues(session), false).patch).toEqual({
      date: session.date,
      location: session.location,
      distance: session.distance,
      faceId: session.faceId,
      seriesCount: session.seriesCount,
      endsPerSeries: session.endsPerSeries,
      arrowsPerEnd: session.arrowsPerEnd,
      notes: session.notes,
    })
  })
})

describe('validateSessionEdit (CU-11)', () => {
  describe('unlocked', () => {
    it('a valid form gives the same full input as creating, trimmed', () => {
      const values = form({ location: '  Sala  ', notes: '  a\nb  ', arrowsPerEnd: '5' })
      const result = validateSessionEdit(values, false)
      expect(result.errors).toEqual({})
      expect(result.patch).toEqual(validateSessionForm(values).input)
      expect(result.patch).toEqual({
        date: '2026-10-17',
        location: 'Sala',
        distance: 18,
        faceId: 'wa-40',
        seriesCount: 2,
        endsPerSeries: 10,
        arrowsPerEnd: 5,
        notes: 'a\nb',
      })
    })

    it('errors match validateSessionForm exactly and the patch is null', () => {
      for (const values of [
        form({ arrowsPerEnd: '13' }),
        form({ faceId: 'missing-face' }),
        form({ date: '', distance: 'x', seriesCount: '0', endsPerSeries: '31' }),
        form({ seriesCount: '25', endsPerSeries: '40', arrowsPerEnd: '13' }),
      ]) {
        const result = validateSessionEdit(values, false)
        expect(result.errors).toEqual(validateSessionForm(values).errors)
        expect(Object.keys(result.errors).length).toBeGreaterThan(0)
        expect(result.patch).toBeNull()
      }
    })

    it('Variable sends distance 0', () => {
      expect(
        validateSessionEdit(form({ variableDistance: true, distance: '' }), false).patch?.distance,
      ).toBe(0)
    })
  })

  describe('locked', () => {
    it('over-limit structure and an unknown face give no errors; patch has only the details', () => {
      const result = validateSessionEdit(
        form({
          faceId: 'missing-face',
          seriesCount: '25',
          endsPerSeries: '40',
          arrowsPerEnd: '13',
          location: '  Nuevo  ',
          notes: ' n ',
        }),
        true,
      )
      expect(result.errors).toEqual({})
      expect(result.patch).toEqual({
        date: '2026-10-17',
        location: 'Nuevo',
        distance: 18,
        notes: 'n',
      })
    })

    it('a valid structure is still not sent', () => {
      const patch = validateSessionEdit(form(), true).patch!
      expect(Object.keys(patch).sort()).toEqual(['date', 'distance', 'location', 'notes'])
    })

    it('an invalid date or distance still errors with the creation messages and a null patch', () => {
      const date = validateSessionEdit(form({ date: '2026-02-30' }), true)
      expect(date.errors).toEqual({
        date: validateSessionForm(form({ date: '2026-02-30' })).errors.date,
      })
      expect(date.patch).toBeNull()

      const distance = validateSessionEdit(form({ distance: '18.5', arrowsPerEnd: '99' }), true)
      expect(distance.errors).toEqual({
        distance: validateSessionForm(form({ distance: '18.5' })).errors.distance,
      })
      expect(distance.patch).toBeNull()
    })
  })
})
