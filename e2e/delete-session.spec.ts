/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const HOME_URL = /\/arco-entrenamiento\/(#\/)?$/
const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/
const SUMMARY_URL = /#\/session\/[^/]+\/summary\?archer=[^&]+$/
const EDIT_URL = /#\/session\/[^/]+\/edit$/
const NOT_FOUND = 'No se encontró la sesión.'
const EMPTY_TEXT = 'Todavía no hay sesiones de entrenamiento.'

/** Fails the test on any console warning/error, uncaught page error or native dialog. */
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

interface StoredSession {
  id: string
  date: string
  location: string
  closed: boolean
  archers: { id: string }[]
}

async function storedSessions(page: Page): Promise<StoredSession[]> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{"sessions":[]}').sessions,
    STORAGE_KEY,
  )
}

function cards(page: Page) {
  return page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
}

/** «Nueva sesión» with the default template and a place → scoring. Returns the scoring URL. */
async function createSession(page: Page, location: string) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await page.getByLabel('Lugar (opcional)', { exact: true }).fill(location)
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

function displayDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Records, from now on, whether «No se encontró la sesión.» is ever rendered, so a one-frame flash
 * of the not-found screen between deleting and navigating is caught.
 */
async function watchNotFound(page: Page) {
  await page.evaluate((text) => {
    const w = window as unknown as { __notFoundSeen: boolean }
    w.__notFoundSeen = false
    new MutationObserver(() => {
      if (document.body.textContent?.includes(text)) w.__notFoundSeen = true
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  }, NOT_FOUND)
}

async function notFoundSeen(page: Page) {
  return page.evaluate(() => (window as unknown as { __notFoundSeen: boolean }).__notFoundSeen)
}

test('two sessions: cancel keeps it; «Borrar» goes home with one card; reload, Back and old routes', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)
  await createSession(page, 'Primera')
  const scoringUrl = await createSession(page, 'Segunda')
  await page.getByRole('button', { name: 'Anotar 9', exact: true }).click()
  await openEdit(page)

  const sessions = await storedSessions(page)
  expect(sessions).toHaveLength(2)
  const target = sessions.find((s) => s.location === 'Segunda')!
  const message = `Se eliminarán la sesión del ${displayDate(target.date)} y todas sus flechas. No se puede deshacer.`
  const editUrl = page.url()

  // «Borrar sesión» → «Cancelar»: nothing changes, focus back on the button.
  const remove = page.getByTestId('delete-session')
  await expect(remove).toHaveText('Borrar sesión')
  await expect(remove).toHaveAttribute('type', 'button')
  await remove.click()
  const dialog = page.getByRole('dialog', { name: '¿Borrar la sesión?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#confirm-dialog-message')).toHaveText(message)
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Borrar', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(editUrl)
  await expect(remove).toBeFocused()
  expect(await storedSessions(page)).toEqual(sessions)

  // Escape cancels too.
  await remove.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(remove).toBeFocused()
  expect(await storedSessions(page)).toEqual(sessions)

  // Unsaved, invalid form changes do not block the delete and are never saved.
  await page.locator('.edit-session').getByLabel('Fecha', { exact: true }).fill('')
  await page.locator('.edit-session').getByLabel('Lugar (opcional)', { exact: true }).fill('X')

  // «Borrar sesión» → «Borrar»: home, one card, heading focused, no not-found flash.
  await watchNotFound(page)
  await remove.click()
  await expect(dialog.locator('#confirm-dialog-message')).toHaveText(message)
  await dialog.getByRole('button', { name: 'Borrar', exact: true }).click()
  await expect(page).toHaveURL(HOME_URL)
  await expect(page.getByRole('heading', { name: 'Sesiones', level: 2 })).toBeFocused()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).getByTestId('card-date-place')).toContainText('Primera')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await notFoundSeen(page)).toBe(false)
  const left = await storedSessions(page)
  expect(left.map((s) => s.location)).toEqual(['Primera'])

  // Reload: still one.
  await page.reload()
  await expect(cards(page)).toHaveCount(1)
  expect(await storedSessions(page)).toEqual(left)

  // Back never reaches the edit form; it lands on the stale summary, which says not found.
  await page.goBack()
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(page.getByText(NOT_FOUND)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editar sesión' })).toHaveCount(0)

  // Every route of the deleted session shows its existing not-found message.
  for (const url of [scoringUrl, scoringUrl.replace(/\/score\/[^/]+$/, '/summary'), editUrl]) {
    await page.goto(url)
    await expect(page.getByText(NOT_FOUND), url).toBeVisible()
    await page.getByRole('link', { name: 'Volver al inicio' }).click()
    await expect(cards(page)).toHaveCount(1)
  }

  expect(problems).toEqual([])
})

test('deleting the only session, finalized, shows the empty text', async ({ page }) => {
  const problems = trackConsole(page)
  await createSession(page, 'Única')
  await page.getByRole('button', { name: 'Anotar 10', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar sesión' }).click()
  await page
    .getByRole('dialog', { name: '¿Finalizar la sesión?' })
    .getByRole('button', { name: 'Finalizar', exact: true })
    .click()
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(page.getByTestId('summary-status')).toHaveText('Finalizada')
  expect((await storedSessions(page))[0]!.closed).toBe(true)

  await page.getByTestId('summary-edit').click()
  await expect(page).toHaveURL(EDIT_URL)
  await watchNotFound(page)
  await page.getByTestId('delete-session').click()
  await page
    .getByRole('dialog', { name: '¿Borrar la sesión?' })
    .getByRole('button', { name: 'Borrar', exact: true })
    .click()
  await expect(page).toHaveURL(HOME_URL)
  await expect(page.getByText(EMPTY_TEXT)).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Sesiones', level: 2 })).toBeFocused()
  expect(await notFoundSeen(page)).toBe(false)
  expect(await storedSessions(page)).toEqual([])

  await page.reload()
  await expect(page.getByText(EMPTY_TEXT)).toBeVisible()

  expect(problems).toEqual([])
})

/** «Borrar sesión» geometry at 375 px: ≥ 48 px tall, inside the viewport, no overflow. */
async function measureDeleteFit(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const main = document.querySelector<HTMLElement>('.app-main')!
    const button = document.querySelector<HTMLElement>('[data-testid="delete-session"]')!
    const zone = button.closest<HTMLElement>('.danger-zone')!
    const form = document.querySelector<HTMLElement>('.edit-session form')!
    const r = button.getBoundingClientRect()
    const style = getComputedStyle(button)
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-danger)'
    document.body.append(probe)
    const danger = getComputedStyle(probe).color
    probe.remove()
    return {
      width,
      docOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width,
      mainOverflow: main.scrollWidth - main.clientWidth,
      height: r.height,
      left: r.left,
      right: r.right,
      textOverflow: button.scrollWidth - button.clientWidth,
      belowForm: zone.getBoundingClientRect().top - form.getBoundingClientRect().bottom,
      color: style.color,
      borderColor: style.borderTopColor,
      danger,
    }
  })
}

test('«Borrar sesión» fits 375 px in light and dark, open and finalized, with wide glyphs', async ({
  page,
}) => {
  const problems = trackConsole(page)
  const scoringUrl = await createSession(page, 'Medidas')
  const editUrl = scoringUrl.replace(/\/score\/[^/]+$/, '/edit')

  for (const closed of [false, true]) {
    if (closed) {
      await page.goto(scoringUrl)
      await page.getByRole('button', { name: 'Anotar 9', exact: true }).click()
      await page.getByRole('button', { name: 'Finalizar sesión' }).click()
      await page
        .getByRole('dialog', { name: '¿Finalizar la sesión?' })
        .getByRole('button', { name: 'Finalizar', exact: true })
        .click()
      await expect(page).toHaveURL(SUMMARY_URL)
    }
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(editUrl)
      await expect(page.getByRole('heading', { name: 'Editar sesión' })).toBeVisible()
      await expect(page.getByTestId('delete-session')).toBeVisible()
      for (const wide of [false, true]) {
        // Margin for CI's wider Linux fonts.
        if (wide) await page.addStyleTag({ content: '.edit-session { letter-spacing: 0.1em; }' })
        const label = `${scheme} closed=${closed} wide=${wide}`
        const m = await measureDeleteFit(page)
        expect(m.width, label).toBe(375)
        expect(m.docOverflow, `${label} document`).toBeLessThanOrEqual(0)
        expect(m.mainOverflow, `${label} .app-main`).toBeLessThanOrEqual(0)
        expect(m.height, label).toBeGreaterThanOrEqual(48)
        expect(m.left, label).toBeGreaterThanOrEqual(0)
        expect(m.right, label).toBeLessThanOrEqual(m.width + 0.5)
        expect(m.textOverflow, `${label} text`).toBeLessThanOrEqual(0)
        // Its own section after the form.
        expect(m.belowForm, label).toBeGreaterThanOrEqual(0)
        // Danger styling in both themes.
        expect(m.color, label).toBe(m.danger)
        expect(m.borderColor, label).toBe(m.danger)
      }
    }
  }

  expect(problems).toEqual([])
})
