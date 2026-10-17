/// <reference lib="dom" />
// Browser globals are used inside page.evaluate callbacks; tsconfig.node.json has no DOM lib.

// CU-14 Instalar en el móvil: manifest, icons, iOS metas, service worker and installability,
// all served under the GitHub Pages subpath configured in playwright.config.ts.
import { expect, test, type APIResponse, type Page } from '@playwright/test'

const BACKGROUND = '#111827'
const RED = '#F65058'
const YELLOW = '#FFE552'

interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

interface Manifest {
  name: string
  short_name: string
  lang: string
  display: string
  start_url: string
  scope: string
  theme_color: string
  background_color: string
  icons: ManifestIcon[]
}

type Rgba = [number, number, number, number]

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

/** Relative URL: no scheme, no protocol-relative or root-absolute prefix. */
function expectRelative(url: string) {
  expect(url, `${url} must be relative`).not.toMatch(/^([a-z][a-z0-9+.-]*:|\/)/i)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function expectColor(actual: Rgba, hex: string, label: string, tolerance = 8) {
  const [r, g, b] = hexToRgb(hex)
  const ok =
    Math.abs(actual[0] - r) <= tolerance &&
    Math.abs(actual[1] - g) <= tolerance &&
    Math.abs(actual[2] - b) <= tolerance &&
    actual[3] === 255
  expect(ok, `${label}: rgba(${actual.join(',')}) should be ~${hex} and opaque`).toBe(true)
}

/** Reads width/height from the IHDR chunk after checking the PNG signature. */
function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.toString('ascii', 12, 16)).toBe('IHDR')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

async function expectPng(response: APIResponse, sizes: string, label: string) {
  expect(response.status(), `${label} status`).toBe(200)
  expect(response.headers()['content-type'], `${label} content-type`).toMatch(/^image\/png/)
  const { width, height } = pngSize(await response.body())
  expect(`${width}x${height}`, `${label} IHDR size`).toBe(sizes)
}

async function loadManifest(page: Page): Promise<{ url: string; manifest: Manifest }> {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).not.toBeNull()
  expectRelative(href!)
  const url = new URL(href!, page.url()).href
  const response = await page.request.get(url)
  expect(response.status()).toBe(200)
  return { url, manifest: (await response.json()) as Manifest }
}

/** Loads a same-origin image into a canvas and returns the RGBA pixels. */
async function readPixels(page: Page, url: string) {
  return page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { width: canvas.width, height: canvas.height, data: Array.from(data) }
  }, url)
}

function pixelAt(img: { width: number; data: number[] }, x: number, y: number): Rgba {
  const i = (y * img.width + x) * 4
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!]
}

test.describe('CU-14 instalar en el móvil', () => {
  let problems: string[]

  test.beforeEach(async ({ page }) => {
    problems = trackConsole(page)
    await page.goto('./')
    await expect(page.getByRole('button', { name: 'Nueva sesión' })).toBeVisible()
  })

  test.afterEach(() => {
    expect(problems).toEqual([])
  })

  test('the page is served under the GitHub Pages subpath', async ({ page }) => {
    expect(new URL(page.url()).pathname).toBe('/arco-entrenamiento/')
  })

  test('the manifest loads from a relative link and declares the app identity', async ({
    page,
  }) => {
    const { url, manifest } = await loadManifest(page)
    expect(new URL(url).pathname).toBe('/arco-entrenamiento/manifest.webmanifest')

    expect(manifest.name).toBe('Arco · Entrenamientos')
    expect(manifest.short_name).toBe('Arco')
    expect(manifest.lang).toBe('es')
    expect(manifest.display).toBe('standalone')
    expectRelative(manifest.start_url)
    expectRelative(manifest.scope)
    // Resolved against the manifest URL they land on the subpath, not the origin root.
    expect(new URL(manifest.start_url, url).pathname).toBe('/arco-entrenamiento/')
    expect(new URL(manifest.scope, url).pathname).toBe('/arco-entrenamiento/')
    expect(manifest.theme_color.toLowerCase()).toBe(BACKGROUND)
    expect(manifest.background_color.toLowerCase()).toBe(BACKGROUND)

    const has = (sizes: string, purpose: string) =>
      manifest.icons.some(
        (icon) =>
          icon.sizes === sizes &&
          icon.type === 'image/png' &&
          (icon.purpose ?? 'any').split(/\s+/).includes(purpose),
      )
    expect(has('192x192', 'any')).toBe(true)
    expect(has('512x512', 'any')).toBe(true)
    expect(has('512x512', 'maskable')).toBe(true)
  })

  test('every manifest icon is relative and serves a PNG of its declared size', async ({
    page,
  }) => {
    const { url, manifest } = await loadManifest(page)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
    for (const icon of manifest.icons) {
      expectRelative(icon.src)
      const iconUrl = new URL(icon.src, url)
      expect(iconUrl.pathname.startsWith('/arco-entrenamiento/')).toBe(true)
      await expectPng(await page.request.get(iconUrl.href), icon.sizes, icon.src)
    }
  })

  test('index.html links the favicons, the apple-touch-icon and the iOS app metas', async ({
    page,
  }) => {
    const svgHref = await page
      .locator('link[rel="icon"][type="image/svg+xml"]')
      .getAttribute('href')
    expect(svgHref).not.toBeNull()
    expectRelative(svgHref!)
    const svg = await page.request.get(new URL(svgHref!, page.url()).href)
    expect(svg.status()).toBe(200)
    expect(svg.headers()['content-type']).toMatch(/^image\/svg\+xml/)

    const pngIcons = [
      { selector: 'link[rel="icon"][type="image/png"]', sizes: '32x32' },
      { selector: 'link[rel="apple-touch-icon"]', sizes: '180x180' },
    ]
    for (const { selector, sizes } of pngIcons) {
      const link = page.locator(selector)
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute('sizes', sizes)
      const href = (await link.getAttribute('href'))!
      expectRelative(href)
      await expectPng(await page.request.get(new URL(href, page.url()).href), sizes, href)
    }

    const meta = (name: string) => page.locator(`meta[name="${name}"]`)
    await expect(meta('mobile-web-app-capable')).toHaveAttribute('content', 'yes')
    await expect(meta('apple-mobile-web-app-capable')).toHaveAttribute('content', 'yes')
    await expect(meta('apple-mobile-web-app-title')).toHaveAttribute('content', 'Arco')
    await expect(meta('apple-mobile-web-app-status-bar-style')).toHaveAttribute(
      'content',
      /^(default|black|black-translucent)$/,
    )
  })

  test('the source SVG is the flat target centre on the dark background', async ({ page }) => {
    const response = await page.request.get(new URL('favicon.svg', page.url()).href)
    expect(response.status()).toBe(200)
    const svg = (await response.text()).replace(/<!--[\s\S]*?-->/g, '')

    const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]!.toUpperCase())
    expect(fills).toEqual([BACKGROUND.toUpperCase(), RED, YELLOW])
    // Exactly the two centre discs: no outer rings, arrow, text, strokes or gradients.
    expect(svg.match(/<circle\b/g)).toHaveLength(2)
    expect(svg).not.toMatch(/<(path|line|polygon|polyline|text|linearGradient|radialGradient)\b/)
    expect(svg).not.toMatch(/stroke=/)
  })

  test('the opaque icons show yellow centre, red ring and dark corners', async ({ page }) => {
    const icons = [
      { file: 'pwa-512x512.png', size: 512 },
      { file: 'pwa-192x192.png', size: 192 },
      { file: 'apple-touch-icon-180x180.png', size: 180 },
      { file: 'favicon-32x32.png', size: 32 },
    ]
    for (const { file, size } of icons) {
      const img = await readPixels(page, new URL(file, page.url()).href)
      expect(img.width).toBe(size)
      const c = Math.floor(size / 2)
      // Yellow disc radius ~0.21 of the side, red disc ~0.42: sample the ring at ~0.31.
      const ring = c + Math.round(size * 0.31)
      expectColor(pixelAt(img, c, c), YELLOW, `${file} centre`)
      expectColor(pixelAt(img, ring, c), RED, `${file} ring`)
      for (const [x, y] of [
        [0, 0],
        [size - 1, 0],
        [0, size - 1],
        [size - 1, size - 1],
      ] as const) {
        // iOS fills transparency with black: every corner must be the opaque dark background.
        expectColor(pixelAt(img, x, y), BACKGROUND, `${file} corner ${x},${y}`)
      }
    }
  })

  test('the maskable icon keeps all artwork inside the central 80 % safe zone', async ({
    page,
  }) => {
    const img = await readPixels(page, new URL('maskable-icon-512x512.png', page.url()).href)
    expect(img.width).toBe(512)
    expect(img.height).toBe(512)
    const c = 256
    expectColor(pixelAt(img, c, c), YELLOW, 'maskable centre')
    expectColor(pixelAt(img, c + 140, c), RED, 'maskable ring')

    // Safe zone: circle of radius 40 % of the side. Everything outside it must be background.
    const safeRadius = 0.4 * 512
    const [r, g, b] = hexToRgb(BACKGROUND)
    const offenders: string[] = []
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= safeRadius) continue
        const [pr, pg, pb, pa] = pixelAt(img, x, y)
        if (Math.abs(pr - r) > 8 || Math.abs(pg - g) > 8 || Math.abs(pb - b) > 8 || pa !== 255) {
          offenders.push(`${x},${y}=rgba(${pr},${pg},${pb},${pa})`)
          if (offenders.length >= 5) break
        }
      }
      if (offenders.length >= 5) break
    }
    expect(offenders).toEqual([])
  })

  test('a service worker controls the page with the subpath scope', async ({ page }) => {
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 15_000,
    })
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })
    expect(new URL(scope).pathname).toBe('/arco-entrenamiento/')
    const controllerUrl = await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)
    expect(new URL(controllerUrl).pathname).toBe('/arco-entrenamiento/sw.js')
  })
})
