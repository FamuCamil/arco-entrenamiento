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
  opts: { closed?: boolean; filledRows?: number } = {},
): Promise<string> {
  const ends = Array.from({ length: 20 }, (_, r) =>
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
