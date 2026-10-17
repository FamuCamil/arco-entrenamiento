/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Locator, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/
const SUMMARY_URL = /#\/session\/[^/]+\/summary\?archer=[^&]+$/

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

function keypad(page: Page) {
  return page.getByRole('group', { name: 'Teclado de puntuación' })
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

const zoneCount = (page: Page, key: string) =>
  page.getByTestId(`zone-count-${key}`).locator('.zone-count')

test('summary from scoring and after «Finalizar»: totals, counts, distribution, navigation', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)
  page.on('dialog', (d) => {
    problems.push(`native dialog: ${d.message()}`)
    void d.dismiss()
  })

  // 1. Create a session and score two ends of X, 10, 9.
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  const scoringUrl = page.url()
  for (let end = 0; end < 2; end++)
    for (const name of ['Anotar X', 'Anotar 10', 'Anotar 9'])
      await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 58/600')
  const scoringGrand = await page.getByTestId('grand-total').textContent()
  const scoringAverage = await page.getByTestId('average').textContent()

  // 2. «Resumen»: the same totals, tiebreak counts and distribution.
  const open = page.getByRole('link', { name: 'Resumen' })
  await expectTouchTargetInViewport(page, open)
  await open.click()
  await expect(page).toHaveURL(SUMMARY_URL)
  const heading = page.getByRole('heading', { name: 'Resumen', level: 2 })
  await expect(heading).toBeFocused()
  await expect(page.getByTestId('summary-archer')).toHaveText('A - Yo')
  await expect(page.getByTestId('summary-status')).toHaveCount(0)
  const table = page.getByRole('table', { name: 'Resumen por tandas' })
  await expect(table).toBeVisible()
  await expect(page.getByTestId('summary-grand-total')).toHaveText(scoringGrand!.trim())
  await expect(page.getByTestId('summary-grand-total')).toHaveText('TOTAL GENERAL: 58/600')
  await expect(page.getByTestId('summary-series-total-0')).toHaveText('Total Serie 1: 58/300')
  await expect(page.getByTestId('summary-end-total-0')).toHaveText('29/30')
  await expect(page.getByTestId('summary-running-total-1')).toHaveText('58')
  await expect(page.getByTestId('summary-end-total-2')).toHaveText('')
  await expect(table.getByRole('columnheader', { name: 'Flechas de 10' })).toHaveText('10')
  await expect(table.getByRole('columnheader', { name: 'Flechas de 9' })).toHaveText('9')
  await expect(page.getByTestId('summary-grand-count-0')).toHaveText('4')
  await expect(page.getByTestId('summary-grand-count-1')).toHaveText('2')
  await expect(page.getByTestId('summary-average')).toHaveText(scoringAverage!.trim())
  await expect(page.getByTestId('summary-average')).toHaveText('Promedio: 9.67')
  const distribution = page.getByRole('list', { name: 'Reparto por zonas' })
  await expect(distribution.getByRole('listitem')).toHaveCount(12)
  for (const key of ['X', '10', '9']) await expect(zoneCount(page, key)).toHaveText('2')
  for (const key of ['8', '7', '6', '5', '4', '3', '2', '1', 'M'])
    await expect(zoneCount(page, key)).toHaveText('0')
  // Read-only: no buttons at all on the summary.
  await expect(page.locator('.summary button, .summary input')).toHaveCount(0)

  // «Volver a anotar» returns to the same scoring screen.
  const back = page.getByRole('link', { name: 'Volver a anotar' })
  await expectTouchTargetInViewport(page, back)
  await expectTouchTargetInViewport(page, page.getByRole('link', { name: 'Inicio' }))
  await back.click()
  await expect(page).toHaveURL(scoringUrl)
  await expect(keypad(page)).toBeVisible()

  // Browser Back from the summary also returns to scoring (router.push, no history tricks).
  await page.getByRole('link', { name: 'Resumen' }).click()
  await expect(page).toHaveURL(SUMMARY_URL)
  await page.goBack()
  await expect(page).toHaveURL(scoringUrl)
  await expect(keypad(page)).toBeVisible()

  // 3. «Finalizar sesión» → «Finalizar»: the summary opens, finalized, heading focused.
  await page.getByRole('button', { name: 'Finalizar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: '¿Finalizar la sesión?' })
  await dialog.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(SUMMARY_URL)
  await expect(heading).toBeFocused()
  await expect(page.getByTestId('summary-status')).toHaveText('Finalizada')
  await expect(page.getByTestId('summary-status').locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page.getByTestId('summary-grand-total')).toHaveText('TOTAL GENERAL: 58/600')

  // 4. «Ver tabla»: scoring read-only with «Reabrir sesión»; «Resumen» still there.
  const viewTable = page.getByRole('link', { name: 'Ver tabla' })
  await expectTouchTargetInViewport(page, viewTable)
  await viewTable.click()
  await expect(page).toHaveURL(scoringUrl)
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(keypad(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reabrir sesión' })).toBeVisible()
  await expectTouchTargetInViewport(page, page.getByRole('link', { name: 'Resumen' }))

  // «Inicio» from the summary goes home.
  await page.getByRole('link', { name: 'Resumen' }).click()
  await page.getByRole('link', { name: 'Inicio' }).click()
  await expect(page.getByRole('list', { name: 'Sesiones guardadas' })).toBeVisible()

  expect(problems).toEqual([])
})

/** Seeds one session before the app boots (only if storage is still empty). */
async function seedSession(
  page: Page,
  session: {
    faceId: string
    location: string
    distance: number
    seriesCount: number
    endsPerSeries: number
    arrowsPerEnd: number
    ends: (string | null)[][]
    closed: boolean
  },
) {
  const { ends, ...fields } = session
  const state = {
    version: 1,
    profileName: '',
    sessions: [
      {
        id: 'worst',
        date: '2026-10-15',
        notes: '',
        createdAt: 1,
        updatedAt: 1,
        archers: [{ id: 'worst-archer', name: 'Yo', position: 'A', ends }],
        ...fields,
      },
    ],
  }
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  )
}

/**
 * Summary geometry: nothing scrolls horizontally (`.app-main` scrolls on its own, so it is
 * measured too) and no descendant leaves the summary's content box.
 */
async function measureSummaryFit(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.app-main')!
    const summary = document.querySelector<HTMLElement>('.summary')!
    const box = summary.getBoundingClientRect()
    const escapes = Array.from(summary.querySelectorAll<Element>('*'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5))
      .map(({ el, r }) => `${el.tagName}.${el.getAttribute('class')}: ${r.left}-${r.right}`)
    const clipped = Array.from(
      summary.querySelectorAll<HTMLElement>('.summary-table th, .summary-table td'),
    )
      .filter((el) => el.scrollWidth > el.clientWidth + 0.5)
      .map((el) => `${el.dataset.testid ?? el.tagName}: ${el.textContent?.trim()}`)
    const zoneTops = new Set(
      Array.from(summary.querySelectorAll('.distribution li')).map((li) =>
        Math.round(li.getBoundingClientRect().top),
      ),
    )
    return {
      width: document.documentElement.clientWidth,
      left: box.left,
      right: box.right,
      mainOverflow: main.scrollWidth - main.clientWidth,
      docOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        document.documentElement.clientWidth,
      escapes,
      clipped,
      zoneLines: zoneTops.size,
    }
  })
}

async function expectSummaryFits(page: Page, label: string) {
  const m = await measureSummaryFit(page)
  expect(m.width, label).toBe(375)
  expect(m.left, label).toBeGreaterThanOrEqual(0)
  expect(m.right, label).toBeLessThanOrEqual(m.width)
  expect(m.mainOverflow, `${label} .app-main`).toBeLessThanOrEqual(0)
  expect(m.docOverflow, `${label} document`).toBeLessThanOrEqual(0)
  expect(m.escapes, label).toEqual([])
  expect(m.clipped, label).toEqual([])
  for (const id of ['summary-back', 'summary-home'])
    await expectTouchTargetInViewport(page, page.getByTestId(id))
  return m
}

const LONG_PLACE = 'Polideportivo Municipal de Villanueva de la Cañada, pista cubierta norte'

test('worst case fits 375 px: 3D 2×6×12 all «11» («1584/1584»), long place, finalized', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(LONG_PLACE.length).toBeGreaterThanOrEqual(70)
  await seedSession(page, {
    faceId: '3d',
    location: LONG_PLACE,
    distance: 0,
    seriesCount: 2,
    endsPerSeries: 6,
    arrowsPerEnd: 12,
    ends: Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => '11')),
    closed: true,
  })

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('./#/session/worst/summary')
    await expect(page.getByTestId('summary-status')).toHaveText('Finalizada')
    await expect(page.getByTestId('summary-date-place')).toContainText(LONG_PLACE)
    await expect(page.getByTestId('summary-distance-face')).toHaveText('Variable · 3D')
    await expect(page.getByTestId('summary-end-total-0')).toHaveText('132/132')
    await expect(page.getByTestId('summary-running-total-5')).toHaveText('792')
    await expect(page.getByTestId('summary-series-total-1')).toHaveText('Total Serie 2: 792/792')
    await expect(page.getByTestId('summary-grand-total')).toHaveText('TOTAL GENERAL: 1584/1584')
    await expect(page.getByRole('columnheader', { name: 'Flechas de 11' })).toHaveText('11')
    await expect(page.getByRole('columnheader', { name: 'Flechas de 10' })).toHaveText('10')
    await expect(page.getByTestId('summary-count-0-0')).toHaveText('12')
    await expect(page.getByTestId('summary-series-count-0-0')).toHaveText('72')
    await expect(page.getByTestId('summary-grand-count-0')).toHaveText('144')
    await expect(page.getByTestId('summary-grand-count-1')).toHaveText('0')
    await expect(page.getByTestId('summary-average')).toHaveText('Promedio: 11.00')
    await expect(zoneCount(page, '11')).toHaveText('144')
    await expect(page.getByRole('link', { name: 'Ver tabla' })).toBeVisible()
    await expectSummaryFits(page, scheme)
  }

  // Margin for CI's wider Linux fonts: still fits with every glyph 10 % wider.
  await page.addStyleTag({ content: '.summary { letter-spacing: 0.1em; }' })
  await expectSummaryFits(page, 'wide glyphs')

  expect(problems).toEqual([])
})

test('WA 122: the 12-zone distribution wraps onto several lines inside 375 px', async ({
  page,
}) => {
  const problems = trackConsole(page)
  const keys = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M']
  await seedSession(page, {
    faceId: 'wa-122',
    location: 'Club',
    distance: 70,
    seriesCount: 2,
    endsPerSeries: 6,
    arrowsPerEnd: 6,
    ends: Array.from({ length: 12 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) => keys[(r * 6 + c) % 12]!),
    ),
    closed: false,
  })
  await page.goto('./#/session/worst/summary?archer=worst-archer')
  await expect(page.getByTestId('summary-distance-face')).toHaveText('70 m · WA 122 cm')
  await expect(page.getByRole('link', { name: 'Volver a anotar' })).toBeVisible()
  // 72 arrows over 12 zones: 6 in each, sum = arrows shot.
  for (const key of keys) await expect(zoneCount(page, key)).toHaveText('6')
  const m = await expectSummaryFits(page, 'wa-122')
  expect(m.zoneLines).toBeGreaterThan(1)
  await page.addStyleTag({ content: '.summary { letter-spacing: 0.1em; }' })
  await expectSummaryFits(page, 'wa-122 wide glyphs')
  expect(problems).toEqual([])
})

test('not found: unknown session and unknown archer, message and link home, no console errors', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await seedSession(page, {
    faceId: 'wa-40',
    location: 'Club',
    distance: 18,
    seriesCount: 1,
    endsPerSeries: 1,
    arrowsPerEnd: 3,
    ends: [[null, null, null]],
    closed: false,
  })
  await page.goto('./#/session/nope/summary')
  await expect(page.getByText('No se encontró la sesión.')).toBeVisible()
  await page.goto('./#/session/worst/summary?archer=nope')
  await expect(page.getByText('No se encontró el arquero.')).toBeVisible()
  await page.getByRole('link', { name: 'Volver al inicio' }).click()
  await expect(page.getByRole('list', { name: 'Sesiones guardadas' })).toBeVisible()
  expect(problems).toEqual([])
})
