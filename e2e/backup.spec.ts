/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { readFile } from 'node:fs/promises'

import { expect, test, type Locator, type Page } from '@playwright/test'

const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/
const FILE_NAME = /^arco-copia-\d{4}-\d{2}-\d{2}\.json$/

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

function cards(page: Page) {
  return page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
}

function section(page: Page) {
  return page.getByTestId('backup-section')
}

async function cardLabels(page: Page): Promise<(string | null)[]> {
  return cards(page).evaluateAll((links) => links.map((l) => l.getAttribute('aria-label')))
}

/** Creates a session through «Nueva sesión» → «Crear», optionally scoring its first end. */
async function createSession(page: Page, place: string, arrows: string[] = []) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await expect(page).toHaveURL(/#\/new$/)
  await page.getByLabel('Lugar (opcional)').fill(place)
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  for (const name of arrows) await page.getByRole('button', { name, exact: true }).click()
}

/** ≥48 px tall and horizontally inside the 375 px viewport. */
async function expectFits(page: Page, target: Locator) {
  const width = page.viewportSize()!.width
  const box = (await target.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(48)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
}

/** Nothing scrolls horizontally: the document and `.app-main` (which scrolls on its own). */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.app-main')!
    const root = document.documentElement
    return {
      root: root.scrollWidth - root.clientWidth,
      main: main.scrollWidth - main.clientWidth,
    }
  })
  expect(overflow).toEqual({ root: 0, main: 0 })
}

/** The backup section, its buttons and any visible notice fit the 375 px viewport. */
async function expectSectionFits(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectFits(page, page.getByTestId('export-backup'))
  await expectFits(page, page.getByTestId('import-backup'))
  const notices = page.getByTestId('backup-notice')
  for (let i = 0; i < (await notices.count()); i++) {
    const box = (await notices.nth(i).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await expectFits(page, notices.nth(i).getByTestId('backup-notice-close'))
  }
}

async function newSessionBox(page: Page) {
  return (await page.getByRole('button', { name: 'Nueva sesión' }).boundingBox())!
}

test.beforeEach(async ({ page }) => {
  // Chromium without Web Share of files, so «Exportar copia» takes the download path.
  await page.addInitScript(() => {
    const proto = Navigator.prototype as unknown as Record<string, unknown>
    delete proto.share
    delete proto.canShare
  })
})

test('export to a file, clear storage, import it back, re-import «al día», reject an invalid file', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)

  // Empty state: the section is there, export disabled, and it fits.
  await page.goto('./')
  await expect(page.getByText('Todavía no hay sesiones de entrenamiento.')).toBeVisible()
  await expect(section(page).getByRole('heading', { name: 'Copia de seguridad' })).toBeVisible()
  await expect(page.getByTestId('export-backup')).toHaveAttribute('aria-disabled', 'true')
  expect(await page.evaluate(() => 'share' in navigator)).toBe(false)
  await expectSectionFits(page)
  const emptyBox = await newSessionBox(page)

  // 1. Two sessions through the real flow, one with a scored end.
  await createSession(page, 'Club')
  await createSession(page, 'Pabellón', ['Anotar X', 'Anotar 9', 'Anotar 8'])
  await expect(page.getByTestId('end-total-0')).toHaveText('27/30')
  await page.goto('./')
  await expect(cards(page)).toHaveCount(2)
  const labels = await cardLabels(page)
  expect(labels.some((l) => l?.includes('27'))).toBe(true)
  expect(await newSessionBox(page)).toEqual(emptyBox)
  await expectSectionFits(page)

  // 2. «Exportar copia» downloads the backup.
  const exportButton = section(page).getByRole('button', { name: 'Exportar copia' })
  await expect(exportButton).not.toHaveAttribute('aria-disabled', 'true')
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()])
  expect(download.suggestedFilename()).toMatch(FILE_NAME)
  const path = await download.path()
  const content = await readFile(path, 'utf8')
  expect(content).toContain('\n  "version": 1,')
  const backup = JSON.parse(content)
  expect(Object.keys(backup)).toEqual(['version', 'sessions', 'profileName', 'exportedAt'])
  expect(backup.version).toBe(1)
  expect(backup.sessions).toHaveLength(2)
  expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt)
  await expect(page.getByTestId('backup-notice')).toHaveCount(0)

  // 3. Clear storage and reload: empty list, export disabled.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText('Todavía no hay sesiones de entrenamiento.')).toBeVisible()
  await expect(page.getByTestId('export-backup')).toHaveAttribute('aria-disabled', 'true')

  // 4. Import the downloaded file: confirm says «2 sesiones» → «Importar».
  await page.getByTestId('import-input').setInputFiles(path)
  const dialog = page.getByRole('dialog', { name: '¿Importar copia?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('2 sesiones')
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(cards(page)).toHaveCount(2)
  expect(await cardLabels(page)).toEqual(labels)
  const status = section(page).getByRole('status')
  await expect(status).toHaveText(
    /Copia importada: 2 sesiones añadidas, 0 actualizadas y 0 sin cambios\./,
  )
  await expectSectionFits(page)
  expect(await newSessionBox(page)).toEqual(emptyBox)

  // Survives a reload (persisted).
  await page.reload()
  expect(await cardLabels(page)).toEqual(labels)

  // 5. Import again: «al día», no dialog.
  await page.getByTestId('import-input').setInputFiles(path)
  await expect(section(page).getByRole('status')).toContainText('al día')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(2)
  await expectSectionFits(page)

  // The notice closes with «×».
  await page.getByRole('button', { name: 'Cerrar aviso' }).click()
  await expect(page.getByTestId('backup-notice')).toHaveCount(0)

  // 6. An invalid file: error alert, list unchanged.
  await page.getByTestId('import-input').setInputFiles({
    name: 'copia.json',
    mimeType: 'application/json',
    buffer: Buffer.from('esto no es JSON'),
  })
  const alert = section(page).getByRole('alert')
  await expect(alert).toHaveText(/El archivo no es una copia válida: no contiene JSON\./)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await cardLabels(page)).toEqual(labels)

  // 7. Fit at 375 px with the (longest) error notice showing.
  await expectSectionFits(page)
  expect(await newSessionBox(page)).toEqual(emptyBox)

  expect(problems).toEqual([])
})

test('import «Cancelar» changes nothing and returns focus to «Importar copia»', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await createSession(page, 'Club')
  await page.goto('./')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-backup').click(),
  ])
  const path = await download.path()
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // «Importar copia» opens the system file picker (the hidden input).
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('import-backup').click(),
  ])
  expect(chooser.isMultiple()).toBe(false)
  await chooser.setFiles(path)
  const dialog = page.getByRole('dialog', { name: '¿Importar copia?' })
  await expect(dialog).toContainText('Se añadirá 1 sesión.')
  await expectFits(page, dialog.getByRole('button', { name: 'Importar', exact: true }))
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('import-backup')).toBeFocused()
  await expect(cards(page)).toHaveCount(0)
  const storedCount = await page.evaluate(() => {
    const raw = localStorage.getItem('archery-training:v1')
    return raw === null ? 0 : (JSON.parse(raw) as { sessions: unknown[] }).sessions.length
  })
  expect(storedCount).toBe(0)

  expect(problems).toEqual([])
})
