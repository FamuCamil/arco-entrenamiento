/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/
const SUMMARY_URL = /#\/session\/[^/]+\/summary\?archer=[^&]+$/
const EDIT_URL = /#\/session\/[^/]+\/edit$/
const LOCKED_TEXT =
  'La diana y la estructura no se pueden cambiar porque la sesión ya tiene flechas anotadas.'
const LOCKABLE = ['Diana', 'Series', 'Tandas por serie', 'Flechas por tanda'] as const

/** Fails the test on any console warning/error or uncaught page error. */
function trackConsole(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('dialog', (d) => {
    problems.push(`native dialog: ${d.message()}`)
    void d.dismiss()
  })
  return problems
}

/** Rendered line count of an element's text (distinct line-box tops). Runs in the page. */
function renderedLines(el: Element): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  const tops = Array.from(range.getClientRects())
    .filter((r) => r.width > 0)
    .map((r) => Math.round(r.top))
  return new Set(tops).size
}

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)
}

async function storedRaw(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
}

function field(page: Page, label: string) {
  return page.locator('.edit-session').getByLabel(label, { exact: true })
}

/** «Nueva sesión» with the default «Sala 18 m» (WA 40, 2×10×3) → scoring. */
async function createSession(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  return page.url()
}

/** Scoring → «Resumen» → «Editar datos». */
async function openEdit(page: Page) {
  await page.getByRole('link', { name: 'Resumen' }).click()
  await expect(page).toHaveURL(SUMMARY_URL)
  await page.getByTestId('summary-edit').click()
  await expect(page).toHaveURL(EDIT_URL)
  await expect(page.getByRole('heading', { name: 'Editar sesión', level: 2 })).toBeFocused()
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(SUMMARY_URL)
}

test('without arrows: edits date, place, notes and arrows per end; summary, scoring and home update', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)
  const scoringUrl = await createSession(page)
  await openEdit(page)

  // Pre-filled from the stored session, no templates, nothing locked.
  await expect(field(page, 'Lugar (opcional)')).toHaveValue('')
  await expect(field(page, 'Distancia (m)')).toHaveValue('18')
  await expect(field(page, 'Flechas por tanda')).toHaveValue('3')
  await expect(page.getByRole('group', { name: 'Plantillas' })).toHaveCount(0)
  await expect(page.getByTestId('structure-locked')).toHaveCount(0)
  for (const label of LOCKABLE) await expect(field(page, label)).toBeEnabled()

  await field(page, 'Fecha').fill('2026-10-20')
  await field(page, 'Lugar (opcional)').fill('Pabellón Norte')
  await field(page, 'Notas (opcional)').fill('Viento lateral\nCambiar cuerda')
  await field(page, 'Flechas por tanda').fill('5')
  await save(page)

  await expect(page.getByRole('heading', { name: 'Resumen', level: 2 })).toBeFocused()
  await expect(page.getByTestId('summary-date-place')).toHaveText('20/10/2026 · Pabellón Norte')
  const notes = page.getByTestId('summary-notes')
  await expect(notes).toBeVisible()
  expect(await notes.evaluate((el) => el.textContent)).toBe('Viento lateral\nCambiar cuerda')
  // Two rendered lines (pre-wrap keeps the break).
  const lines = await notes.evaluate(renderedLines)
  expect(lines).toBe(2)

  // The save popped the edit entry: Back from the summary goes to scoring, with 5 cells per end.
  await page.goBack()
  await expect(page).toHaveURL(scoringUrl)
  const firstRow = page.locator('table.series').first().locator('tbody tr').first()
  await expect(firstRow.locator('td.score-cell')).toHaveCount(5)

  const session = (await stored(page)).sessions[0]
  expect(session).toMatchObject({
    date: '2026-10-20',
    location: 'Pabellón Norte',
    notes: 'Viento lateral\nCambiar cuerda',
    arrowsPerEnd: 5,
    closed: false,
  })
  expect(session.archers[0].ends).toHaveLength(20)
  for (const end of session.archers[0].ends) expect(end).toEqual([null, null, null, null, null])

  await page.goto('./')
  const card = page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
  await expect(card).toHaveCount(1)
  await expect(card.getByTestId('card-date-place')).toHaveText('20/10/2026 · Pabellón Norte')
  await expect(card.getByTestId('card-structure')).toHaveText('2×10×5')

  expect(problems).toEqual([])
})

test('with an arrow: face and structure locked with the explanation; the place still saves', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await createSession(page)
  await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await openEdit(page)

  const hint = page.getByTestId('structure-locked')
  await expect(hint).toHaveText(LOCKED_TEXT)
  const hintId = await hint.getAttribute('id')
  for (const label of LOCKABLE) {
    await expect(field(page, label)).toBeDisabled()
    await expect(field(page, label)).toHaveAttribute('aria-describedby', hintId!)
  }
  for (const label of ['Fecha', 'Lugar (opcional)', 'Distancia (m)', 'Notas (opcional)'])
    await expect(field(page, label)).toBeEnabled()

  await field(page, 'Lugar (opcional)').fill('Campo de tiro')
  await save(page)
  await expect(page.getByTestId('summary-date-place')).toContainText('Campo de tiro')

  const session = (await stored(page)).sessions[0]
  expect(session).toMatchObject({ location: 'Campo de tiro', faceId: 'wa-40', arrowsPerEnd: 3 })
  expect(session.archers[0].ends[0]).toEqual(['X', null, null])

  expect(problems).toEqual([])
})

test('a finalized session edits its notes and stays finalized and read-only', async ({ page }) => {
  const problems = trackConsole(page)
  await createSession(page)
  await page.getByRole('button', { name: 'Anotar 9', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: '¿Finalizar la sesión?' })
  await dialog.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(page.getByTestId('summary-status')).toHaveText('Finalizada')

  await page.getByTestId('summary-edit').click()
  await expect(page).toHaveURL(EDIT_URL)
  await field(page, 'Notas (opcional)').fill('Buena sesión')
  await save(page)

  await expect(page.getByTestId('summary-status')).toHaveText('Finalizada')
  await expect(page.getByTestId('summary-notes')).toHaveText('Buena sesión')
  expect((await stored(page)).sessions[0]).toMatchObject({ notes: 'Buena sesión', closed: true })

  await page.getByRole('link', { name: 'Ver tabla' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(page.getByRole('button', { name: 'Reabrir sesión' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Teclado de puntuación' })).toHaveCount(0)

  expect(problems).toEqual([])
})

test('«Cancelar» after editing fields leaves the session unchanged; Back does the same', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await createSession(page)
  await openEdit(page)
  const before = await storedRaw(page)

  await field(page, 'Lugar (opcional)').fill('No guardar')
  await field(page, 'Series').fill('4')
  await field(page, 'Notas (opcional)').fill('Tampoco')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(page.getByTestId('summary-date-place')).toContainText('Sin lugar')
  await expect(page.getByTestId('summary-notes')).toHaveCount(0)
  expect(await storedRaw(page)).toBe(before)

  // Browser Back from the edit screen equals «Cancelar».
  await page.getByTestId('summary-edit').click()
  await expect(page).toHaveURL(EDIT_URL)
  await field(page, 'Lugar (opcional)').fill('Tampoco esto')
  await page.goBack()
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(page.getByTestId('summary-date-place')).toContainText('Sin lugar')
  expect(await storedRaw(page)).toBe(before)

  expect(problems).toEqual([])
})

test('unknown session: message and link home, no console output', async ({ page }) => {
  const problems = trackConsole(page)
  await page.goto('./#/session/nope/edit')
  await expect(page.getByText('No se encontró la sesión.')).toBeVisible()
  await page.getByRole('link', { name: 'Volver al inicio' }).click()
  await expect(page.getByRole('button', { name: 'Nueva sesión' })).toBeVisible()
  expect(problems).toEqual([])
})

/** Edit screen geometry: no horizontal scroll, every control ≥ 48 px and inside 375 px. */
async function measureEditFit(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const main = document.querySelector<HTMLElement>('.app-main')!
    const root = document.querySelector<HTMLElement>('.edit-session')!
    const box = root.getBoundingClientRect()
    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a, input:not([type="checkbox"]), select, textarea, label.checkbox',
      ),
    ).map((el) => {
      const r = el.getBoundingClientRect()
      return { name: `${el.tagName}#${el.id}: ${el.textContent?.trim() ?? ''}`, r }
    })
    const escapes = Array.from(root.querySelectorAll<Element>('*'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5))
      .map(({ el, r }) => `${el.tagName}.${el.getAttribute('class')}: ${r.left}-${r.right}`)
    const hint = root.querySelector<HTMLElement>('[data-testid="structure-locked"]')
    return {
      width,
      docOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width,
      mainOverflow: main.scrollWidth - main.clientWidth,
      controls: controls.map(({ name, r }) => ({
        name,
        height: r.height,
        left: r.left,
        right: r.right,
      })),
      escapes,
      hint: hint && {
        overflow: hint.scrollWidth - hint.clientWidth,
        right: hint.getBoundingClientRect().right,
      },
    }
  })
}

async function expectEditFits(page: Page, label: string, locked: boolean) {
  const m = await measureEditFit(page)
  expect(m.width, label).toBe(375)
  expect(m.docOverflow, `${label} document`).toBeLessThanOrEqual(0)
  expect(m.mainOverflow, `${label} .app-main`).toBeLessThanOrEqual(0)
  expect(m.escapes, label).toEqual([])
  // 6 inputs, select, textarea, the «Variable» label, «Guardar cambios», «Cancelar» and
  // «Borrar sesión».
  expect(m.controls.length, label).toBe(12)
  for (const c of m.controls) {
    expect(c.height, `${label} ${c.name}`).toBeGreaterThanOrEqual(48)
    expect(c.left, `${label} ${c.name}`).toBeGreaterThanOrEqual(0)
    expect(c.right, `${label} ${c.name}`).toBeLessThanOrEqual(m.width + 0.5)
  }
  if (locked) {
    expect(m.hint, label).not.toBeNull()
    expect(m.hint!.overflow, `${label} hint`).toBeLessThanOrEqual(0)
    expect(m.hint!.right, `${label} hint`).toBeLessThanOrEqual(m.width)
    // The message is longer than one 375 px line, so it must wrap.
    const lines = await page.getByTestId('structure-locked').evaluate(renderedLines)
    expect(lines, `${label} hint`).toBeGreaterThan(1)
  } else {
    expect(m.hint, label).toBeNull()
  }
}

test('edit screen fits 375 px in light and dark, locked and unlocked, with wide glyphs', async ({
  page,
}) => {
  const problems = trackConsole(page)
  const scoringUrl = await createSession(page)
  const editUrl = scoringUrl.replace(/\/score\/[^/]+$/, '/edit')

  for (const locked of [false, true]) {
    if (locked) {
      await page.goto(scoringUrl)
      await page.getByRole('button', { name: 'Anotar 10', exact: true }).click()
    }
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(editUrl)
      await expect(page.getByRole('heading', { name: 'Editar sesión' })).toBeVisible()
      await expect(page.getByTestId('structure-locked')).toHaveCount(locked ? 1 : 0)
      // With an error visible too (date cleared): messages must not widen the page.
      await field(page, 'Fecha').fill('')
      await expect(page.locator('.edit-session .error')).toHaveCount(1)
      await expectEditFits(page, `${scheme} locked=${locked} with error`, locked)
      await field(page, 'Fecha').fill('2026-10-17')
      await expectEditFits(page, `${scheme} locked=${locked}`, locked)
    }
    // Margin for CI's wider Linux fonts.
    await page.addStyleTag({ content: '.edit-session { letter-spacing: 0.1em; }' })
    await expectEditFits(page, `wide glyphs locked=${locked}`, locked)
  }

  expect(problems).toEqual([])
})
