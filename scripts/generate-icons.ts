/// <reference lib="dom" />
// Browser globals are used inside the evaluate callback; tsconfig.node.json has no DOM lib.

// Rasterizes public/favicon.svg into the PNG app icons, using the Playwright
// Chromium the project already has (no extra dependency). Run with `npm run icons`
// and commit the resulting PNGs: the build and CI never regenerate them.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const BACKGROUND = '#111827'
// The maskable icon draws the artwork at this scale so the red disc
// (radius 0.42 of the side) stays inside the 0.40 safe-zone radius.
const MASKABLE_SCALE = 0.85
// Large fixed viewport: outputs are taken with a clip, so a browser minimum
// window size can never distort the small icons.
const VIEWPORT = 600

interface IconOutput {
  file: string
  size: number
  scale: number
}

const OUTPUTS: IconOutput[] = [
  { file: 'pwa-192x192.png', size: 192, scale: 1 },
  { file: 'pwa-512x512.png', size: 512, scale: 1 },
  { file: 'maskable-icon-512x512.png', size: 512, scale: MASKABLE_SCALE },
  { file: 'apple-touch-icon-180x180.png', size: 180, scale: 1 },
  { file: 'favicon-32x32.png', size: 32, scale: 1 },
]

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

function pngSize(png: Buffer): { width: number; height: number } {
  const signature = '89504e470d0a1a0a'
  if (
    png.subarray(0, 8).toString('hex') !== signature ||
    png.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new Error('Output is not a valid PNG')
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

function pageHtml(svg: string, size: number, scale: number): string {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const art = Math.round(size * scale)
  const offset = (size - art) / 2
  return `<!doctype html><html><body style="margin:0;background:${BACKGROUND}">
<div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;background:${BACKGROUND}">
<img id="art" src="${src}" style="position:absolute;left:${offset}px;top:${offset}px;width:${art}px;height:${art}px">
</div></body></html>`
}

async function main(): Promise<void> {
  const svg = await readFile(`${publicDir}favicon.svg`, 'utf8')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT, height: VIEWPORT },
      deviceScaleFactor: 1,
    })
    for (const { file, size, scale } of OUTPUTS) {
      await page.setContent(pageHtml(svg, size, scale))
      await page.locator('#art').evaluate((img: HTMLImageElement) => img.decode())
      const png = await page.screenshot({
        clip: { x: 0, y: 0, width: size, height: size },
        omitBackground: false,
      })
      const { width, height } = pngSize(png)
      if (width !== size || height !== size) {
        throw new Error(`${file}: expected ${size}x${size}, got ${width}x${height}`)
      }
      await writeFile(`${publicDir}${file}`, png)
      console.log(`wrote public/${file} (${width}x${height})`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
