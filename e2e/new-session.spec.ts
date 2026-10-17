/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Page } from '@playwright/test'

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

async function expectSelected(page: Page, row: number, col: number) {
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1)
  await expect(cell(page, row, col)).toHaveAttribute('aria-current', 'true')
}

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY)
}

async function openForm(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await expect(page).toHaveURL(/#\/new$/)
  await expect(page.getByRole('heading', { name: 'Nueva sesión' })).toBeVisible()
}

function template(page: Page, label: string) {
  return page.getByRole('group', { name: 'Plantillas' }).getByRole('button', {
    name: label,
    exact: true,
  })
}

function keypad(page: Page) {
  return page.getByRole('group', { name: 'Teclado de puntuación' }).getByRole('button')
}

async function docOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      document.documentElement.clientWidth,
  )
}

test('creates «Aire libre 70 m», scores an arrow and reopens it from the home list', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)
  await openForm(page)

  await template(page, 'Aire libre 70 m').click()
  await expect(template(page, 'Aire libre 70 m')).toHaveAttribute('aria-pressed', 'true')
  await expect(template(page, 'Sala 18 m')).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  const scoringUrl = page.url()

  // 2 × 6 × 6 on WA 122.
  const tables = page.locator('table.series')
  await expect(tables).toHaveCount(2)
  for (const t of await tables.all()) {
    await expect(t.locator('tbody tr')).toHaveCount(6)
    for (const row of await t.locator('tbody tr').all())
      await expect(row.locator('td.score-cell')).toHaveCount(6)
  }
  await expectSelected(page, 0, 0)
  await expect(keypad(page)).toHaveText([
    'X',
    '10',
    '9',
    '8',
    '7',
    '6',
    '5',
    '4',
    '3',
    '2',
    '1',
    'M',
  ])
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 0/720')
  const state = await stored(page)
  expect(state.sessions).toHaveLength(1)
  expect(state.sessions[0]).toMatchObject({
    location: '',
    distance: 70,
    faceId: 'wa-122',
    seriesCount: 2,
    endsPerSeries: 6,
    arrowsPerEnd: 6,
    notes: '',
  })

  await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await expect(cell(page, 0, 0)).toHaveText('X')

  // Back home: the session's card reads «DD/MM/YYYY · Sin lugar» and reopens it.
  await page.goto('./')
  const today = await page.evaluate(() => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${d.getFullYear()}`
  })
  const rows = page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
  await expect(rows).toHaveCount(1)
  await expect(rows.first().getByTestId('card-date-place')).toHaveText(`${today} · Sin lugar`)
  await rows.first().click()
  await expect(page).toHaveURL(scoringUrl)
  await expect(cell(page, 0, 0)).toHaveText('X')
  await expectSelected(page, 0, 1)

  await page.reload()
  await expect(cell(page, 0, 0)).toHaveText('X')
  expect((await stored(page)).sessions).toHaveLength(1)

  expect(problems).toEqual([])
})

test('creates a custom 1 × 2 × 12 session on the field face', async ({ page }) => {
  const problems = trackConsole(page)
  await openForm(page)

  await template(page, 'Personalizada').click()
  await expect(template(page, 'Personalizada')).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Series', { exact: true }).fill('1')
  await page.getByLabel('Tandas por serie').fill('2')
  await page.getByLabel('Flechas por tanda').fill('12')
  await page.getByLabel('Diana').selectOption({ label: 'WA Campo' })
  await page.getByLabel('Lugar (opcional)').fill('  Campo de tiro  ')
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)

  await expect(page.locator('table.series')).toHaveCount(1)
  for (const row of [0, 1])
    for (let col = 0; col < 12; col++) await expect(cell(page, row, col)).toBeVisible()
  await expect(cell(page, 0, 12)).toHaveCount(0)
  await expect(cell(page, 2, 0)).toHaveCount(0)
  await expectSelected(page, 0, 0)
  await expect(keypad(page)).toHaveText(['X', '6', '5', '4', '3', '2', '1', 'M'])
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 0/144')
  expect(await docOverflow(page)).toBe(0)

  const state = await stored(page)
  expect(state.sessions[0]).toMatchObject({
    location: 'Campo de tiro',
    faceId: 'wa-field',
    seriesCount: 1,
    endsPerSeries: 2,
    arrowsPerEnd: 12,
  })
  expect(state.sessions[0].archers[0].ends).toEqual([
    Array.from({ length: 12 }, () => null),
    Array.from({ length: 12 }, () => null),
  ])

  expect(problems).toEqual([])
})

test('13 arrows: «Crear» is disabled and the message is linked to the field', async ({ page }) => {
  const problems = trackConsole(page)
  await openForm(page)

  const arrows = page.getByLabel('Flechas por tanda')
  const create = page.getByRole('button', { name: 'Crear' })
  await expect(create).toBeEnabled()

  await arrows.fill('13')
  await expect(create).toBeDisabled()
  const message = page.getByText('Entre 1 y 12 flechas')
  await expect(message).toBeVisible()
  const messageId = await message.getAttribute('id')
  expect(messageId).toBeTruthy()
  await expect(arrows).toHaveAttribute('aria-describedby', messageId!)
  await expect(arrows).toHaveAttribute('aria-invalid', 'true')
  await expect(arrows).toHaveAccessibleDescription('Entre 1 y 12 flechas')
  await expect(template(page, 'Personalizada')).toHaveAttribute('aria-pressed', 'true')

  await arrows.fill('12')
  await expect(create).toBeEnabled()
  await expect(message).toHaveCount(0)
  await expect(arrows).not.toHaveAttribute('aria-invalid', 'true')

  expect(await stored(page)).toBeNull()
  expect(problems).toEqual([])
})

test('/new fits 375 px with ≥ 48 px controls; «Cancelar» goes home without creating', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await openForm(page)
  // The longest label wraps instead of widening the grid.
  await template(page, 'Aire libre 50 m compuesto').click()

  // With every error visible too: the messages must not widen the page either.
  for (const label of ['Series', 'Tandas por serie', 'Flechas por tanda'])
    await page.getByLabel(label, { exact: true }).fill('99')
  await page.getByLabel('Distancia (m)').fill('')

  for (const state of ['errors', 'valid'] as const) {
    if (state === 'valid') await template(page, 'Sala 18 m').click()
    const m = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.new-session button, .new-session a, .new-session input:not([type="checkbox"]), .new-session select, .new-session textarea, .new-session label.checkbox',
        ),
      ).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          name: `${el.tagName}#${el.id}: ${el.textContent?.trim() ?? ''}`,
          height: r.height,
          left: r.left,
          right: r.right,
        }
      })
      return {
        width,
        controls,
        docOverflow:
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width,
      }
    })
    expect(m.docOverflow, state).toBe(0)
    // 9 templates, 6 inputs, select, textarea, the «Variable» label, «Crear» and «Cancelar».
    expect(m.controls.length, state).toBe(20)
    for (const c of m.controls) {
      expect(c.height, `${state} ${c.name}`).toBeGreaterThanOrEqual(48)
      expect(c.left, `${state} ${c.name}`).toBeGreaterThanOrEqual(0)
      expect(c.right, `${state} ${c.name}`).toBeLessThanOrEqual(m.width + 0.5)
    }
  }

  await page.getByRole('link', { name: 'Cancelar' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: 'Nueva sesión' })).toBeVisible()
  await expect(page.getByText('Todavía no hay sesiones de entrenamiento.')).toBeVisible()
  expect(await stored(page)).toBeNull()

  expect(problems).toEqual([])
})
