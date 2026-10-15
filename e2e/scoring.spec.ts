/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const KEYS = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M']

/** Fails the test on any console warning/error or uncaught page error. */
function trackConsole(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  return problems
}

function cell(page: Page, row: number, col: number) {
  return page.getByTestId(`score-cell-${row}-${col}`)
}

async function expectSelected(page: Page, row: number, col: number) {
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1)
  await expect(cell(page, row, col)).toHaveAttribute('aria-current', 'true')
}

async function openTestSession(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Sesión de prueba' }).click()
  await expect(page).toHaveURL(/#\/session\/[^/]+\/score\/[^/]+$/)
}

/** Seeds one WA 40 2×10×3 session before the app boots (only if storage is still empty). */
async function seed(
  page: Page,
  opts: { closed?: boolean; filledRows?: number; ends?: (string | null)[][] } = {},
): Promise<string> {
  const ends =
    opts.ends ??
    Array.from({ length: 20 }, (_, r) =>
      r < (opts.filledRows ?? 0) ? ['X', '9', '8'] : [null, null, null],
    )
  const state = {
    version: 1,
    profileName: '',
    sessions: [
      {
        id: 'seed-session',
        date: '2026-10-15',
        location: 'Club',
        distance: 18,
        faceId: 'wa-40',
        seriesCount: 2,
        endsPerSeries: 10,
        arrowsPerEnd: 3,
        archers: [{ id: 'seed-archer', name: 'Yo', position: 'A', ends }],
        notes: '',
        closed: opts.closed ?? false,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  )
  return '#/session/seed-session/score/seed-archer'
}

test('scores a full end, advances the selection and keeps it after reload', async ({ page }) => {
  const problems = trackConsole(page)
  await openTestSession(page)

  await expect(page.getByRole('heading', { name: 'A - Yo' })).toBeVisible()
  const tables = page.locator('table')
  await expect(tables).toHaveCount(2)
  await expect(tables.locator('caption')).toHaveText(['Serie 1', 'Serie 2'])
  for (const t of await tables.all()) {
    await expect(t.locator('tbody tr')).toHaveCount(10)
    for (const row of await t.locator('tbody tr').all())
      await expect(row.locator('td')).toHaveCount(3)
  }
  await expectSelected(page, 0, 0)

  const keypad = page.getByRole('group', { name: 'Teclado de puntuación' })
  await expect(keypad.getByRole('button')).toHaveText(KEYS)

  await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await expect(cell(page, 0, 0)).toHaveText('X')
  await expectSelected(page, 0, 1)
  await page.getByRole('button', { name: 'Anotar 9', exact: true }).click()
  await expect(cell(page, 0, 1)).toHaveText('9')
  await expectSelected(page, 0, 2)
  await page.getByRole('button', { name: 'Anotar fallo', exact: true }).click()
  await expect(cell(page, 0, 2)).toHaveText('M')
  await expectSelected(page, 1, 0)

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.version).toBe(1)
  expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', '9', 'M'])

  await page.reload()
  await expect(cell(page, 0, 0)).toHaveText('X')
  await expect(cell(page, 0, 1)).toHaveText('9')
  await expect(cell(page, 0, 2)).toHaveText('M')
  await expectSelected(page, 1, 0)

  expect(problems).toEqual([])
})

test('a second «Sesión de prueba» click reopens the same session', async ({ page }) => {
  await openTestSession(page)
  const first = page.url()
  await page.getByRole('button', { name: 'Anotar 10', exact: true }).click()
  await page.goto('./')
  await page.getByRole('button', { name: 'Sesión de prueba' }).click()
  await expect(page).toHaveURL(first)
  await expect(cell(page, 0, 0)).toHaveText('10')
  const count = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).sessions.length,
    STORAGE_KEY,
  )
  expect(count).toBe(1)
})

test('fits 375 px: no horizontal scroll, keypad fully visible with ≥48 px keys', async ({
  page,
}) => {
  await openTestSession(page)
  expect(page.viewportSize()?.width).toBe(375)

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))
  expect(overflow).toEqual({ doc: 0, body: 0 })

  const viewport = page.viewportSize()!
  const keys = page.getByRole('group', { name: 'Teclado de puntuación' }).getByRole('button')
  await expect(keys).toHaveCount(12)
  for (const key of await keys.all()) {
    const box = (await key.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(48)
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    await expect(key).toHaveAttribute('aria-label', /^Anotar /)
  }

  // Safe areas: the page opts into viewport-fit=cover and the layout pads with env(safe-area-inset-*).
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  )
  const usesSafeArea = await page.evaluate(() =>
    Array.from(document.styleSheets).some((sheet) =>
      Array.from(sheet.cssRules).some((r) => r.cssText.includes('safe-area-inset-bottom')),
    ),
  )
  expect(usesSafeArea).toBe(true)
})

test('keys take their colors from the catalog', async ({ page }) => {
  await openTestSession(page)
  const bg = (key: string) =>
    page.getByTestId(`key-${key}`).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await bg('X')).toBe('rgb(250, 204, 21)')
  expect(await bg('8')).toBe('rgb(239, 68, 68)')
  expect(await bg('6')).toBe('rgb(59, 130, 246)')
  expect(await bg('4')).toBe('rgb(17, 24, 39)')
  expect(await bg('2')).toBe('rgb(255, 255, 255)')
  expect(await bg('M')).toBe('rgb(209, 213, 219)')
})

test('opens a session deep in series 2 with the active row in view', async ({ page }) => {
  const url = await seed(page, { filledRows: 17 })
  await page.goto(`./${url}`)
  await expectSelected(page, 17, 0)
  await expect(page.getByTestId('score-row-17')).toBeInViewport()
  // Proves it scrolled: the first row is out of view.
  await expect(page.getByTestId('score-row-0')).not.toBeInViewport()
  // Scoring keeps the new active row visible too.
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await expectSelected(page, 18, 0)
  await expect(page.getByTestId('score-row-18')).toBeInViewport()
})

test('stays on the last cell and overwrites it', async ({ page }) => {
  const url = await seed(page, { filledRows: 19 })
  await page.goto(`./${url}`)
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Anotar 7', exact: true }).click()
  await expectSelected(page, 19, 2)
  await page.getByRole('button', { name: 'Anotar 1', exact: true }).click()
  await expect(cell(page, 19, 2)).toHaveText('1')
  await expectSelected(page, 19, 2)
})

test('a closed session shows the lock and no keypad', async ({ page }) => {
  const problems = trackConsole(page)
  const url = await seed(page, { closed: true })
  await page.goto(`./${url}`)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(page.getByRole('group', { name: 'Teclado de puntuación' })).toHaveCount(0)
  await expect(page.locator('table')).toHaveCount(2)
  expect(problems).toEqual([])
})

test('corrects an arrow by tapping it; the correction survives a reload', async ({ page }) => {
  const problems = trackConsole(page)
  await openTestSession(page)
  for (const name of ['Anotar X', 'Anotar 9', 'Anotar fallo'])
    await page.getByRole('button', { name, exact: true }).click()
  await expectSelected(page, 1, 0)

  await cell(page, 0, 1).click()
  await expectSelected(page, 0, 1)
  await expect(cell(page, 1, 0)).not.toHaveClass(/is-selected/)
  await page.getByRole('button', { name: 'Anotar 7', exact: true }).click()
  await expect(cell(page, 0, 1)).toHaveText('7')
  await expectSelected(page, 0, 2)
  // X, 7, M is already best-to-worst, so CU-06 sorting leaves it as it is.
  await expect(page.getByTestId('score-row-0').locator('td')).toHaveText(['X', '7', 'M'])
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', '7', 'M'])

  await page.reload()
  await expect(page.getByTestId('score-row-0').locator('td')).toHaveText(['X', '7', 'M'])
  await expectSelected(page, 1, 0)
  expect(problems).toEqual([])
})

test('sorts a completed end, re-sorts it on a correction and keeps it after reload (CU-06)', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)
  await openTestSession(page)
  const row0 = page.getByTestId('score-row-0').locator('td')

  // An incomplete end stays where the arrows were put.
  for (const name of ['Anotar 7', 'Anotar fallo'])
    await page.getByRole('button', { name, exact: true }).click()
  await expect(row0).toHaveText(['7', 'M', ''])

  // Completing it sorts it best-to-worst at once (no animation wait).
  await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await expect(row0).toHaveText(['X', '7', 'M'], { timeout: 1000 })
  await expectSelected(page, 1, 0)
  const duration = await cell(page, 0, 0).evaluate((el) => getComputedStyle(el).transitionDuration)
  expect(duration).toBe('0s')
  let stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', '7', 'M'])

  // Correct the first arrow to 5: the value moves to col 1, but the selection advances from
  // the touched cell (0,0) to (0,1).
  await cell(page, 0, 0).click()
  await expectSelected(page, 0, 0)
  await page.getByRole('button', { name: 'Anotar 5', exact: true }).click()
  await expect(row0).toHaveText(['7', '5', 'M'], { timeout: 1000 })
  await expectSelected(page, 0, 1)
  stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.sessions[0].archers[0].ends[0]).toEqual(['7', '5', 'M'])

  await page.reload()
  await expect(page.getByTestId('score-row-0').locator('td')).toHaveText(['7', '5', 'M'])
  await expectSelected(page, 1, 0)
  expect(problems).toEqual([])
})

test('cells are ≥48 px tall, named, reachable with Tab and selectable with Enter/Space', async ({
  page,
}) => {
  const problems = trackConsole(page)
  const url = await seed(page, { filledRows: 1 })
  await page.goto(`./${url}`)
  await expectSelected(page, 1, 0)

  for (const [r, c] of [
    [0, 0],
    [0, 2],
    [1, 1],
  ] as const) {
    const box = (await cell(page, r, c).boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(48)
    const btn = (await cell(page, r, c).getByRole('button').boundingBox())!
    expect(btn.height).toBeGreaterThanOrEqual(48)
  }

  const second = page.getByRole('button', { name: 'Serie 1, tanda 1, flecha 2: 9', exact: true })
  await expect(second).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Serie 1, tanda 2, flecha 1: vacía', exact: true }),
  ).toBeVisible()

  // Enter on a focused cell selects it.
  await second.focus()
  await page.keyboard.press('Enter')
  await expectSelected(page, 0, 1)

  // Tab moves to the next cell; the keyboard focus ring is visible; Space selects it.
  await page.keyboard.press('Tab')
  const third = cell(page, 0, 2).getByRole('button')
  await expect(third).toBeFocused()
  await expect(third).toHaveCSS('outline-style', 'dashed')
  await page.keyboard.press('Space')
  await expectSelected(page, 0, 2)

  // The keyboard selection is a real selection: the next key overwrites that cell.
  await page.getByRole('button', { name: 'Anotar 5', exact: true }).click()
  await expect(cell(page, 0, 2)).toHaveText('5')
  await expectSelected(page, 1, 0)
  expect(problems).toEqual([])
})

test('a closed session: tapping a cell changes neither selection nor value', async ({ page }) => {
  const problems = trackConsole(page)
  const url = await seed(page, { closed: true, filledRows: 1 })
  await page.goto(`./${url}`)
  await expectSelected(page, 1, 0)
  await expect(page.locator('table button')).toHaveCount(0)
  await cell(page, 0, 1).click()
  await expectSelected(page, 1, 0)
  await expect(cell(page, 0, 1)).toHaveText('9')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(stored.sessions[0].archers[0].ends[0]).toEqual(['X', '9', '8'])
  expect(problems).toEqual([])
})

test('with a gap left by out-of-order scoring, the first gap is selected on load', async ({
  page,
}) => {
  const ends = Array.from({ length: 20 }, (_, r) =>
    r === 0 || r === 2 ? ['X', '9', '8'] : [null, null, null],
  )
  const url = await seed(page, { ends })
  await page.goto(`./${url}`)
  await expectSelected(page, 1, 0)
  await page.reload()
  await expectSelected(page, 1, 0)
})

test('scoring out of order: tap a later empty cell, write, and the gap stays', async ({ page }) => {
  await openTestSession(page)
  await cell(page, 2, 0).click()
  await expectSelected(page, 2, 0)
  await page.getByRole('button', { name: 'Anotar 10', exact: true }).click()
  await expect(cell(page, 2, 0)).toHaveText('10')
  await expectSelected(page, 2, 1)
  await page.reload()
  await expect(cell(page, 2, 0)).toHaveText('10')
  await expectSelected(page, 0, 0)
})

for (const [name, path] of [
  ['unknown session', '#/session/nope/score/nope'],
  ['valid session, unknown archer', '#/session/seed-session/score/nope'],
] as const) {
  test(`not found (${name}): message and link home, no console errors`, async ({ page }) => {
    const problems = trackConsole(page)
    await seed(page)
    await page.goto(`./${path}`)
    await expect(page.getByText('No se encontró la sesión.')).toBeVisible()
    await page.getByRole('link', { name: 'Volver al inicio' }).click()
    await expect(page.getByRole('button', { name: 'Sesión de prueba' })).toBeVisible()
    expect(problems).toEqual([])
  })
}

test('corrupt storage: the app starts empty without breaking', async ({ page }) => {
  const problems = trackConsole(page)
  await page.addInitScript((key) => localStorage.setItem(key, '{corrupt'), STORAGE_KEY)
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Sesión de prueba' })).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(`${key}:corrupt`), STORAGE_KEY)).toBe(
    '{corrupt',
  )
  expect(problems).toEqual([])
})

/** Seeds row 0 = X 9 8 and row 1 = 7 6 _, so entry selects the gap at row 1, arrow 3. */
async function seedForDelete(page: Page, closed = false): Promise<string> {
  const ends = Array.from({ length: 20 }, (_, r) =>
    r === 0 ? ['X', '9', '8'] : r === 1 ? ['7', '6', null] : [null, null, null],
  )
  return seed(page, { ends, closed })
}

async function storedEnds(page: Page): Promise<(string | null)[][]> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).sessions[0].archers[0].ends,
    STORAGE_KEY,
  )
}

test('deletes an arrow, cancels and confirms «Borrar tanda», and keeps it after reload', async ({
  page,
}) => {
  const problems = trackConsole(page)
  // Any native confirm would fail the test: the app must use its own dialog.
  page.on('dialog', (d) => {
    problems.push(`native dialog: ${d.type()}`)
    void d.dismiss()
  })
  const url = await seedForDelete(page)
  await page.goto(`./${url}`)
  expect(page.viewportSize()?.width).toBe(375)
  await expectSelected(page, 1, 2)

  const deleteArrow = page.getByTestId('delete-arrow')
  const deleteEnd = page.getByTestId('delete-end')
  const dialog = page.getByRole('dialog')

  // 1. Borrar flecha: no dialog, the cell empties and the selection stays.
  await cell(page, 0, 1).click()
  await expectSelected(page, 0, 1)
  await deleteArrow.click()
  await expect(dialog).toHaveCount(0)
  await expect(cell(page, 0, 1)).toHaveText('')
  await expectSelected(page, 0, 1)
  await expect(deleteArrow).toHaveAttribute('aria-disabled', 'true')
  expect((await storedEnds(page))[0]).toEqual(['X', null, '8'])

  // 2. Borrar tanda → Cancelar: nothing changes and focus returns to «Borrar tanda».
  await cell(page, 1, 0).click()
  await expectSelected(page, 1, 0)
  await deleteEnd.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog.getByRole('heading', { name: '¿Borrar la tanda?' })).toBeVisible()
  await expect(dialog).toContainText(
    'Se borrarán todas las flechas de la serie 1, tanda 2. No se puede deshacer.',
  )
  await expect(dialog.getByRole('button')).toHaveText(['Cancelar', 'Borrar'])
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['7', '6', ''])
  await expectSelected(page, 1, 0)
  await expect(deleteEnd).toBeFocused()

  // 3. Borrar tanda → Escape: also a cancel.
  await deleteEnd.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['7', '6', ''])
  await expectSelected(page, 1, 0)
  await expect(deleteEnd).toBeFocused()

  // 4. Borrar tanda → Borrar: the end empties and its first arrow is selected.
  await cell(page, 1, 1).click()
  await deleteEnd.click()
  await dialog.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['', '', ''])
  await expectSelected(page, 1, 0)
  await expect(deleteEnd).toHaveAttribute('aria-disabled', 'true')
  await expect(deleteEnd).toBeFocused()
  const ends = await storedEnds(page)
  expect(ends[0]).toEqual(['X', null, '8'])
  expect(ends[1]).toEqual([null, null, null])

  // 5. Reload: the deletions persist and no dialog is open.
  await page.reload()
  await expect(page.getByTestId('score-row-0').locator('td')).toHaveText(['X', '', '8'])
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['', '', ''])
  await expect(dialog).toHaveCount(0)
  await expectSelected(page, 0, 1)

  expect(problems).toEqual([])
})

test('delete buttons are disabled when there is nothing to delete', async ({ page }) => {
  const url = await seedForDelete(page)
  await page.goto(`./${url}`)
  const deleteArrow = page.getByTestId('delete-arrow')
  const deleteEnd = page.getByTestId('delete-end')
  // Gap in a non-empty end.
  await expectSelected(page, 1, 2)
  await expect(deleteArrow).toHaveAttribute('aria-disabled', 'true')
  await expect(deleteEnd).not.toHaveAttribute('aria-disabled', /.*/)
  // Empty end.
  await cell(page, 4, 1).click()
  await expect(deleteArrow).toHaveAttribute('aria-disabled', 'true')
  await expect(deleteEnd).toHaveAttribute('aria-disabled', 'true')
  // Playwright treats aria-disabled as disabled; force the tap to prove it is ignored.
  await expect(deleteEnd).toBeDisabled()
  await deleteEnd.click({ force: true })
  await deleteArrow.click({ force: true })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await storedEnds(page))[1]).toEqual(['7', '6', null])
  // Filled cell.
  await cell(page, 0, 0).click()
  await expect(deleteArrow).not.toHaveAttribute('aria-disabled', /.*/)
})

test('delete actions and dialog fit 375 px with ≥48 px buttons, labels and visible focus', async ({
  page,
}) => {
  const problems = trackConsole(page)
  const url = await seedForDelete(page)
  await page.goto(`./${url}`)
  const viewport = page.viewportSize()!

  const group = page.getByRole('group', { name: 'Acciones de borrado' })
  await expect(group.getByRole('button')).toHaveText(['Borrar flecha', 'Borrar tanda'])
  await expect(page.getByRole('button', { name: 'Borrar flecha seleccionada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Borrar tanda seleccionada' })).toBeVisible()

  async function expectTarget(locator: ReturnType<Page['getByTestId']>) {
    const box = (await locator.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(48)
    expect(box.height).toBeGreaterThanOrEqual(48)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  }
  await expectTarget(page.getByTestId('delete-arrow'))
  await expectTarget(page.getByTestId('delete-end'))

  // Keyboard focus ring on the action buttons.
  await page.getByTestId('delete-arrow').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('delete-end')).toBeFocused()
  await expect(page.getByTestId('delete-end')).toHaveCSS('outline-style', 'solid')

  // Open the dialog from the keyboard: Enter on the focused button.
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectTarget(page.getByTestId('confirm-cancel'))
  await expectTarget(page.getByTestId('confirm-accept'))
  // Bottom-anchored for one-handed use: the panel sits in the lower half of the screen.
  const panel = (await dialog.boundingBox())!
  expect(panel.y).toBeGreaterThan(viewport.height / 2)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  // Focus trap: Tab and Shift+Tab cycle between the two dialog buttons only.
  await expect(page.getByTestId('confirm-cancel')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('confirm-accept')).toBeFocused()
  await expect(page.getByTestId('confirm-accept')).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('confirm-cancel')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('confirm-accept')).toBeFocused()

  // A click on the panel padding leaves focus on body; Escape still cancels.
  await dialog.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('delete-end')).toBeFocused()
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['7', '6', ''])

  // Backdrop tap cancels too.
  await page.getByTestId('delete-end').click()
  await expect(dialog).toBeVisible()
  await page.getByTestId('confirm-backdrop').click({ position: { x: 10, y: 10 } })
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('score-row-1').locator('td')).toHaveText(['7', '6', ''])

  expect(problems).toEqual([])
})

test('a closed session shows no delete actions and keeps its arrows', async ({ page }) => {
  const problems = trackConsole(page)
  const url = await seedForDelete(page, true)
  await page.goto(`./${url}`)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(page.getByRole('group', { name: 'Acciones de borrado' })).toHaveCount(0)
  await expect(page.getByTestId('delete-arrow')).toHaveCount(0)
  await expect(page.getByTestId('delete-end')).toHaveCount(0)
  expect((await storedEnds(page))[0]).toEqual(['X', '9', '8'])
  expect(problems).toEqual([])
})
