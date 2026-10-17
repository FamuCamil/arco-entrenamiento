/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'archery-training:v1'
const SCORING_URL = /#\/session\/[^/]+\/score\/[^/]+$/
const LONG_PLACE = 'A'.repeat(70)

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

function cards(page: Page) {
  return page.getByRole('list', { name: 'Sesiones guardadas' }).getByRole('link')
}

/** Creates a session through «Nueva sesión» → «Crear» (the default template is «Sala 18 m»). */
async function createSession(
  page: Page,
  opts: { place?: string; variable?: boolean; face?: string } = {},
): Promise<string> {
  await page.goto('./')
  await page.getByRole('button', { name: 'Nueva sesión' }).click()
  await expect(page).toHaveURL(/#\/new$/)
  if (opts.place !== undefined) await page.getByLabel('Lugar (opcional)').fill(opts.place)
  if (opts.variable) await page.getByLabel('Variable').check()
  if (opts.face) await page.getByLabel('Diana').selectOption({ label: opts.face })
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(page).toHaveURL(SCORING_URL)
  return page.url()
}

/**
 * Card geometry at the current viewport: each card and every descendant stays inside the card,
 * nothing scrolls horizontally (`.app-main` scrolls on its own, so it is measured too).
 */
async function measureFit(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.app-main')!
    const width = document.documentElement.clientWidth
    const cardsFit = Array.from(document.querySelectorAll<HTMLElement>('.session-card')).map(
      (card) => {
        const box = card.getBoundingClientRect()
        const escapes = Array.from(card.querySelectorAll<Element>('*'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5))
          .map(({ el, r }) => `${el.tagName}.${el.getAttribute('class')}: ${r.left}-${r.right}`)
        const place = card.querySelector<HTMLElement>('.card-place')!
        const placeBox = place.getBoundingClientRect()
        return {
          name: card.getAttribute('aria-label'),
          left: box.left,
          right: box.right,
          height: box.height,
          overflow: card.scrollWidth - card.clientWidth,
          escapes,
          placeTextOverflow: getComputedStyle(place).textOverflow,
          placeTruncated: place.scrollWidth > place.clientWidth,
          placeInside: placeBox.right <= box.right + 0.5,
        }
      },
    )
    return {
      width,
      mainOverflow: main.scrollWidth - main.clientWidth,
      docOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width,
      cards: cardsFit,
    }
  })
}

async function expectFit(page: Page, label: string) {
  const m = await measureFit(page)
  expect(m.width, label).toBe(375)
  expect(m.mainOverflow, `${label} .app-main`).toBeLessThanOrEqual(0)
  expect(m.docOverflow, `${label} document`).toBeLessThanOrEqual(0)
  expect(m.cards.length, label).toBeGreaterThan(0)
  for (const c of m.cards) {
    const name = `${label} ${c.name}`
    expect(c.left, name).toBeGreaterThanOrEqual(0)
    expect(c.right, name).toBeLessThanOrEqual(m.width)
    expect(c.overflow, name).toBeLessThanOrEqual(0)
    expect(c.escapes, name).toEqual([])
    expect(c.height, name).toBeGreaterThanOrEqual(48)
    expect(c.placeTextOverflow, name).toBe('ellipsis')
    expect(c.placeInside, name).toBe(true)
  }
  return m
}

/** Tabs from «Nueva sesión» to the first card: it shows a visible :focus-visible outline. */
async function expectCardFocusVisible(page: Page) {
  await page.getByRole('button', { name: 'Nueva sesión' }).focus()
  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const style = getComputedStyle(el)
    return {
      isCard: el.classList.contains('session-card'),
      focusVisible: el.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    }
  })
  expect(focus.isCard).toBe(true)
  expect(focus.focusVisible).toBe(true)
  expect(focus.outlineStyle).not.toBe('none')
  expect(focus.outlineWidth).toBeGreaterThan(0)
}

test('two sessions from the real flow: order, totals match the scoring screen, card reopens', async ({
  page,
}) => {
  const problems = trackConsole(page)
  expect(page.viewportSize()?.width).toBe(375)

  const clubUrl = await createSession(page, { place: 'Club' })
  await page.getByRole('button', { name: 'Anotar X', exact: true }).click()
  await page.getByRole('button', { name: 'Anotar 9', exact: true }).click()
  await page.getByRole('button', { name: 'Anotar fallo', exact: true }).click()
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 19/600')
  await expect(page.getByTestId('average')).toHaveText('Promedio: 6.33')
  const grand = (await page.getByTestId('grand-total').textContent())!.trim()
  const average = (await page.getByTestId('average').textContent())!.trim()

  await createSession(page, {
    place: LONG_PLACE,
    variable: true,
    face: 'WA 80 cm reducida (6 anillos)',
  })
  await page.goto('./')

  // Same date: the second-created session comes first.
  await expect(cards(page)).toHaveCount(2)
  const [long, club] = [cards(page).nth(0), cards(page).nth(1)]
  await expect(long.locator('.card-place')).toHaveText(LONG_PLACE)
  await expect(long.getByTestId('card-distance-face')).toHaveText(
    'Variable · WA 80 cm reducida (6 anillos)',
  )
  await expect(long.getByTestId('card-structure')).toHaveText('2×10×3')
  await expect(long.locator('.card-total')).toHaveText('Total 0/600')
  await expect(long.locator('.card-average')).toHaveText('Promedio —')
  await expect(long.locator('svg')).toHaveAttribute('data-icon', 'wa-reduced')

  await expect(club.getByTestId('card-date-place')).toHaveText(/^\d{2}\/\d{2}\/\d{4} · Club$/)
  await expect(club.getByTestId('card-distance-face')).toHaveText('18 m · WA 40 cm')
  await expect(club.getByTestId('card-structure')).toHaveText('2×10×3')
  await expect(club.locator('svg')).toHaveAttribute('data-icon', 'wa-full')
  // Parity with the scoring screen: same total and max, same average value.
  await expect(club.locator('.card-total')).toHaveText(grand.replace('TOTAL GENERAL: ', 'Total '))
  await expect(club.locator('.card-average')).toHaveText(average.replace('Promedio: ', 'Promedio '))
  await expect(club.getByTestId('card-totals')).toContainText('Total 19/600')
  await expect(club.getByTestId('card-totals')).toContainText('Promedio 6.33')
  await expect(club).toHaveAccessibleName(/^\d{2}\/\d{2}\/\d{4}, Club, 18 m, WA 40 cm, /)

  const fit = await expectFit(page, 'light')
  expect(fit.cards[0]!.placeTruncated).toBe(true)
  await expectCardFocusVisible(page)

  await club.click()
  await expect(page).toHaveURL(clubUrl)
  await expect(cell(page, 0, 0)).toHaveText('X')
  await expect(cell(page, 0, 1)).toHaveText('9')
  await expect(cell(page, 0, 2)).toHaveText('M')

  expect(problems).toEqual([])
})

/** Seeds sessions before the app boots (only if storage is still empty). */
async function seedWorstCase(page: Page) {
  const session = (
    id: string,
    createdAt: number,
    extra: Record<string, unknown>,
    ends: (string | null)[][],
  ) => ({
    id,
    date: '2026-10-17',
    location: LONG_PLACE,
    distance: 0,
    faceId: 'wa-122',
    seriesCount: 2,
    endsPerSeries: 6,
    arrowsPerEnd: 12,
    archers: [{ id: `${id}-archer`, name: 'Yo', position: 'A', ends }],
    notes: '',
    closed: false,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  })
  // 123 X + one 4 on 2×6×12 WA 122: «Total 1234/1440».
  const arrows: (string | null)[] = Array.from({ length: 144 }, (_, i) =>
    i < 123 ? 'X' : i === 123 ? '4' : null,
  )
  const worstEnds = Array.from({ length: 12 }, (_, r) => arrows.slice(r * 12, r * 12 + 12))
  const state = {
    version: 1,
    profileName: '',
    sessions: [
      // Finalized (CU-10): the «Finalizada» line must fit on the worst card too.
      session('worst', 3, { closed: true }, worstEnds),
      session(
        'reduced',
        2,
        { faceId: 'wa-80-6', seriesCount: 20, endsPerSeries: 30, arrowsPerEnd: 12 },
        Array.from({ length: 600 }, () => Array.from({ length: 12 }, () => '10')),
      ),
      session(
        'spaced',
        1,
        {
          faceId: '3d',
          location: 'Club de tiro con arco de la ciudad con un nombre muy largo y espacios',
          arrowsPerEnd: 2,
        },
        Array.from({ length: 12 }, () => [null, null]),
      ),
    ],
  }
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  )
}

test('seeded worst case «1234/1440» with long places fits 375 px in light and dark', async ({
  page,
}) => {
  const problems = trackConsole(page)
  await seedWorstCase(page)

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('./')
    await expect(cards(page)).toHaveCount(3)
    const worst = cards(page).nth(0)
    const reduced = cards(page).nth(1)
    const spaced = cards(page).nth(2)

    await expect(worst.locator('.card-total')).toHaveText('Total 1234/1440')
    await expect(worst.locator('.card-average')).toHaveText('Promedio 9.95')
    await expect(worst.getByTestId('card-distance-face')).toHaveText('Variable · WA 122 cm')
    await expect(worst.getByTestId('card-structure')).toHaveText('2×6×12')
    await expect(reduced.getByTestId('card-distance-face')).toHaveText(
      'Variable · WA 80 cm reducida (6 anillos)',
    )
    // 20×30×12 at 10 points: the totals stay right on the largest session too.
    await expect(reduced.locator('.card-total')).toHaveText('Total 72000/72000')
    await expect(reduced.getByTestId('card-structure')).toHaveText('20×30×12')
    await expect(spaced.getByTestId('card-distance-face')).toHaveText('Variable · 3D')
    // CU-10: only the finalized card shows the indicator, and its name says so.
    await expect(worst.getByTestId('card-status')).toHaveText('Finalizada')
    await expect(worst.locator('svg.card-status-icon')).toHaveAttribute('aria-hidden', 'true')
    await expect(worst).toHaveAccessibleName(/, Promedio 9\.95, finalizada$/)
    for (const open of [reduced, spaced]) {
      await expect(open.getByTestId('card-status')).toHaveCount(0)
      await expect(open).not.toHaveAccessibleName(/finalizada/)
    }

    const fit = await expectFit(page, scheme)
    expect(fit.cards.map((c) => c.placeTruncated)).toEqual([true, true, true])

    // The icon is drawn at 44 px and the white face has a visible outline on the surface.
    const icon = await worst.locator('svg.card-icon').boundingBox()
    expect(icon?.width).toBe(44)
    expect(icon?.height).toBe(44)
    await expect(worst.locator('svg circle').first()).toHaveAttribute('stroke', '#6b7280')

    await expectCardFocusVisible(page)
  }

  // Margin for CI's wider Linux fonts: still fits with every glyph 10 % wider.
  await page.addStyleTag({ content: '.session-card { letter-spacing: 0.1em; }' })
  await expectFit(page, 'wide glyphs')

  await cards(page).first().click()
  await expect(page).toHaveURL(/#\/session\/worst\/score\/worst-archer$/)
  await expect(page.getByTestId('grand-total')).toHaveText('TOTAL GENERAL: 1234/1440')
  await expect(page.getByTestId('average')).toHaveText('Promedio: 9.95')
  // A finalized card opens the scoring screen read-only.
  await expect(page.getByRole('status')).toHaveText('Sesión finalizada — solo lectura')
  await expect(page.getByRole('group', { name: 'Teclado de puntuación' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reabrir sesión' })).toBeVisible()
  expect(problems).toEqual([])
})
