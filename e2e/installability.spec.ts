/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

// CU-14 headline check: Chromium itself considers the app installable.
import { expect, test, type Page } from '@playwright/test'

// The headless shell answers Page.getInstallabilityErrors with an empty list even for a page
// without a manifest, so this file runs on full Chromium (new headless). CI's
// `npx playwright install --with-deps chromium` installs it alongside the headless shell.
// `channel` forces a new worker, so it can only be set at file level: that is why this test
// lives apart from install.spec.ts.
test.use({ channel: 'chromium' })

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

test('Chromium reports the app as installable', async ({ page }) => {
  const problems = trackConsole(page)
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Nueva sesión' })).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  })
  const cdp = await page.context().newCDPSession(page)

  const manifest = await cdp.send('Page.getAppManifest')
  expect(manifest.url).toMatch(/\/arco-entrenamiento\/manifest\.webmanifest$/)
  expect(manifest.errors).toEqual([])

  // Playwright contexts are incognito-like; that error is about the browser, not the app.
  const appErrors = async () =>
    (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors
      .map((e) => e.errorId)
      .filter((id) => id !== 'in-incognito')
  expect(await appErrors()).toEqual([])

  // Sanity check that the criteria are really evaluated: a page without a manifest fails.
  await page.goto('./manifest.webmanifest')
  expect(await appErrors()).toContain('no-manifest')

  expect(problems).toEqual([])
})
