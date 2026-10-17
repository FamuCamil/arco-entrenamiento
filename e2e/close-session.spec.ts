/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Locator, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/

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

function keypad(page: Page) {
  return page.getByRole('group', { name: 'Teclado de puntuación' })
}

function cards(page: Page) {
  return page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
}

async function storedClosed(page: Page): Promise<boolean> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).sessions[0].closed,
    STORAGE_KEY,
  )
}

/** ≥48 px tall and fully inside the 375 px viewport. */
async function expectTouchTargetInViewport(page: Page, target: Locator) {
  const viewport = page.viewportSize()!
  const box = (await target.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(48)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

test('finalize with confirmation, read-only card and reload, then reopen and keep scoring', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)

  // Create a session and score one end.
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  const scoringUrl = page.url()
  for (const name of ['Anotar X', 'Anotar 9', 'Anotar 8'])
    await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('end-total-0')).toHaveText('27/30')

  const finalize = page.getByRole('button', { name: 'Finalizar sesión' })
  await expect(finalize).toHaveAttribute('data-testid', 'close-session')
  await expectTouchTargetInViewport(page, finalize)
  await expect(keypad(page).getByRole('button')).toHaveCount(12)

  // «Finalizar sesión» → «Cancelar»: nothing changes.
  page.on('dialog', (d) => {
    problems.push(`native dialog: ${d.message()}`)
    void d.dismiss()
  })
  await finalize.click()
  const dialog = page.getByRole('dialog', { name: '¿Finalizar la sesión?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(
    'La sesión quedará en solo lectura. Podrás reabrirla cuando quieras.',
  )
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(finalize).toBeFocused()
  await expect(keypad(page)).toBeVisible()
  expect(await storedClosed(page)).toBe(false)

  // Escape cancels too.
  await finalize.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(keypad(page)).toBeVisible()
  expect(await storedClosed(page)).toBe(false)

  // «Finalizar sesión» → «Finalizar»: read-only.
  await finalize.click()
  await dialog.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(keypad(page)).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Acciones de borrado' })).toHaveCount(0)
  await expect(finalize).toHaveCount(0)
  await expect(page.locator('table button')).toHaveCount(0)
  await expect(page.locator('[aria-current]')).toHaveCount(0)
  await expect(page.getByTestId('end-total-0')).toHaveText('27/30')
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 27/600')
  await expect(page.getByTestId('average')).toHaveText('Promedio: 9.00')
  const reopen = page.getByRole('button', { name: 'Reabrir sesión' })
  await expect(reopen).toBeFocused()
  await expectTouchTargetInViewport(page, reopen)
  await expect(page.getByRole('status')).toBeInViewport()
  expect(await storedClosed(page)).toBe(true)

  // Home: the card shows «Finalizada».
  await page.goto('./')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first().getByTestId('card-status')).toHaveText('Finalizada')
  await expect(cards(page).first()).toHaveAccessibleName(/, finalizada$/)

  // Reload: still finalized, on the card and on the scoring screen.
  await page.reload()
  await expect(cards(page).first().getByTestId('card-status')).toHaveText('Finalizada')
  await cards(page).first().click()
  await expect(page).toHaveURL(scoringUrl)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(keypad(page)).toHaveCount(0)

  // «Reabrir sesión»: at once, keypad back, selection on the first empty cell, scoring works.
  await page.getByRole('button', { name: 'Reabrir sesión' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(keypad(page).getByRole('button')).toHaveCount(12)
  await expect(page.getByRole('button', { name: 'Borrar flecha' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalizar sesión' })).toBeVisible()
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1)
  await expect(cell(page, 1, 0)).toHaveAttribute('aria-current', 'true')
  await expect(cell(page, 1, 0).getByRole('button')).toBeFocused()
  expect(await storedClosed(page)).toBe(false)
  await page.getByRole('button', { name: 'Anotar 7', exact: true }).click()
  await expect(cell(page, 1, 0)).toHaveText('7')

  // Home: no indicator; reload: still open.
  await page.goto('./')
  await expect(cards(page).first().getByTestId('card-status')).toHaveCount(0)
  await expect(cards(page).first()).not.toHaveAccessibleName(/finalizada/)
  await page.reload()
  await expect(cards(page).first().getByTestId('card-status')).toHaveCount(0)
  await cards(page).first().click()
  await expect(keypad(page)).toBeVisible()
  await expect(cell(page, 1, 0)).toHaveText('7')

  expect(problems).toEqual([])
})
