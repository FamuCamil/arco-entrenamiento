/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

// CU-13 Funcionar sin conexión: the service worker precaches the whole app shell, serves the app
// offline under the GitHub Pages subpath configured in playwright.config.ts, and stays silent.
//
// Browser: the default headless shell. setOffline plus a reload served by the service worker is
// reliable there, so this file does not need `channel: 'chromium'`.
// Stability: `npx playwright test e2e/offline.spec.ts --repeat-each=5` passed 15/15 locally
// (macOS, 2026-10-16) with retries at 0.
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

// Paths only: Playwright collects specs before webServer builds, so dist/ is read inside tests.
const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))

// The one console message an offline page legitimately produces: Chromium logs every request
// that reaches the (cut) network, e.g. the offline probe below.
const EXPECTED_OFFLINE_ERROR = /net::ERR_INTERNET_DISCONNECTED/

/** Fails the test on any console warning/error or uncaught page error, except `allowed`. */
function trackConsole(page: Page, allowed?: RegExp): string[] {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    if (allowed?.test(msg.text())) return
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

async function score(page: Page, value: string) {
  await page.getByRole('button', { name: `Anotar ${value}`, exact: true }).click()
}

async function expectArrows(page: Page, arrows: [number, number, string][]) {
  await expect(page.getByRole('heading', { name: 'A - Yo' })).toBeVisible()
  for (const [row, col, value] of arrows) await expect(cell(page, row, col)).toHaveText(value)
}

/** `assets/<name>` for every file the build emitted into dist/assets. */
async function builtAssets(): Promise<string[]> {
  return (await readdir(`${DIST_DIR}assets`)).map((name) => `assets/${name}`)
}

/** The precache manifest URLs baked into dist/sw.js (`{url:"…",revision:…}` entries). */
function precacheUrls(sw: string): string[] {
  return [...sw.matchAll(/url:\s*(["'])([^"']+)\1/g)].map((m) => m[2]!)
}

async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
}

test.describe('CU-13 funcionar sin conexión', () => {
  // The offline flow depends on service-worker timing; CI's `retries: 2` must not hide flakiness.
  test.describe.configure({ retries: 0 })

  test('the precache covers the whole app shell and nothing is cached at runtime', async ({
    request,
  }) => {
    const assets = await builtAssets()
    expect(assets.filter((a) => a.endsWith('.css')).length).toBeGreaterThanOrEqual(1)
    // The entry chunk plus at least the lazy ScoringView chunk.
    expect(assets.filter((a) => a.endsWith('.js')).length).toBeGreaterThanOrEqual(2)

    const sw = await readFile(`${DIST_DIR}sw.js`, 'utf8')
    // Guards against a stale preview server reused locally: it must serve this very build.
    const served = await request.get('./sw.js')
    expect(served.status()).toBe(200)
    expect(await served.text()).toBe(sw)

    const precached = precacheUrls(sw)
    for (const asset of assets.filter((a) => /\.(js|css)$/.test(a)))
      expect(precached, `${asset} must be precached`).toContain(asset)
    expect(precached).toContain('index.html')
    expect(precached).toContain('manifest.webmanifest')
    // Every public/ file must be precached. A file added to public/ later has to be listed in
    // includeAssets (vite.config.ts) or this check fails: that is intended. Dotfiles such as
    // .gitkeep are repository plumbing, not app files.
    for (const file of (await readdir(PUBLIC_DIR)).filter((f) => !f.startsWith('.')))
      expect(precached, `public/${file} must be precached`).toContain(file)

    // The only route is the navigation fallback to index.html.
    expect(sw.match(/registerRoute\(/g)).toHaveLength(1)
    expect(sw).toMatch(/registerRoute\(new \w+\.NavigationRoute\(/)
    expect(sw).toContain('createHandlerBoundToURL("index.html")')
    // No runtime caching strategies: nothing from any other origin can end up in a cache.
    for (const strategy of ['CacheFirst', 'NetworkFirst', 'StaleWhileRevalidate', 'NetworkOnly'])
      expect(sw, `${strategy} must not appear`).not.toContain(strategy)
    // A new version takes control on its own (autoUpdate with injectRegister: false).
    expect(sw).toContain('skipWaiting()')
    expect(sw).toContain('clientsClaim()')
  })

  test('opens, scores and keeps the data offline after the first online visit', async ({
    page,
    context,
  }) => {
    const problems = trackConsole(page, EXPECTED_OFFLINE_ERROR)
    const assets = await builtAssets()

    // 1. First visit online: wait until the service worker controls the page.
    await page.goto('./')
    await expect(page.getByRole('button', { name: 'Sesión de prueba' })).toBeVisible()
    await waitForController(page)

    // 2. Every cached URL is same-origin, and the precache holds the shell.
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys())
        for (const req of await (await caches.open(name)).keys()) urls.push(req.url)
      return urls
    })
    const origin = new URL(page.url()).origin
    for (const url of cached) expect(new URL(url).origin, url).toBe(origin)
    const cachedPaths = cached.map((url) => new URL(url).pathname)
    for (const file of ['index.html', ...assets])
      expect(cachedPaths, `${file} must be in the cache`).toContain(`/arco-entrenamiento/${file}`)

    // 3. Score one end online.
    await page.getByRole('button', { name: 'Sesión de prueba' }).click()
    await expect(page).toHaveURL(/#\/session\/[^/]+\/score\/[^/]+$/)
    const scoringUrl = page.url()
    await score(page, 'X')
    await score(page, '9')
    await score(page, '8')
    await expectSelected(page, 1, 0)

    // 4. Cut the network, and prove it is really cut (no false pass through a live network).
    await context.setOffline(true)
    expect(await page.evaluate(() => navigator.onLine)).toBe(false)
    const probeFailed = await page.evaluate(() =>
      fetch('./__offline-probe__', { cache: 'no-store' }).then(
        () => false,
        () => true,
      ),
    )
    expect(probeFailed).toBe(true)

    // 5. Reload offline: the service worker serves the app with the scored end.
    const response = await page.reload()
    expect(response).not.toBeNull()
    expect(response!.fromServiceWorker()).toBe(true)
    await expectArrows(page, [
      [0, 0, 'X'],
      [0, 1, '9'],
      [0, 2, '8'],
    ])
    await expectSelected(page, 1, 0)

    // 6. Score offline and reload offline again.
    await score(page, '10')
    await expect(cell(page, 1, 0)).toHaveText('10')
    await page.reload()
    const allArrows: [number, number, string][] = [
      [0, 0, 'X'],
      [0, 1, '9'],
      [0, 2, '8'],
      [1, 0, '10'],
    ]
    await expectArrows(page, allArrows)
    await expectSelected(page, 1, 1)

    // 7. Close the app and reopen it, still offline (AC6).
    await page.close()
    const reopened = await context.newPage()
    const reopenedProblems = trackConsole(reopened, EXPECTED_OFFLINE_ERROR)
    await reopened.goto(scoringUrl)
    await expectArrows(reopened, allArrows)

    // 8. A navigation URL that is not in the precache is answered by the fallback (AC2).
    await reopened.goto('./?offline-fallback=1#/')
    await expect(reopened.getByRole('button', { name: 'Sesión de prueba' })).toBeVisible()

    // 9. Silent by user decision: no offline-ready or updated notice anywhere.
    await expect(reopened.locator('[role="alert"]')).toHaveCount(0)
    await expect(reopened.getByText(/sin conexión|actualizad|offline|disponible sin/i)).toHaveCount(
      0,
    )
    await reopened.goto(scoringUrl)
    await expectArrows(reopened, allArrows)
    await expect(reopened.locator('[role="alert"]')).toHaveCount(0)
    await expect(reopened.getByText(/sin conexión|actualizad|offline|disponible sin/i)).toHaveCount(
      0,
    )

    // 10. No console problems beyond the expected offline network failure.
    expect(problems).toEqual([])
    expect(reopenedProblems).toEqual([])
  })

  test('works online without service-worker support', async ({ page }) => {
    const problems = trackConsole(page)
    await page.addInitScript(() => {
      delete (Navigator.prototype as { serviceWorker?: unknown }).serviceWorker
    })

    await page.goto('./')
    expect(await page.evaluate(() => 'serviceWorker' in navigator)).toBe(false)
    await page.getByRole('button', { name: 'Sesión de prueba' }).click()
    await expect(page).toHaveURL(/#\/session\/[^/]+\/score\/[^/]+$/)
    await score(page, 'X')
    await expect(cell(page, 0, 0)).toHaveText('X')

    await page.reload()
    await expectArrows(page, [[0, 0, 'X']])
    await expectSelected(page, 0, 1)

    expect(problems).toEqual([])
  })
})
