import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// The GitHub Pages subpath: the preview serves the build there so relative URLs are exercised.
const BASE_PATH = '/arco-entrenamiento/'
const BASE_URL = `http://localhost:${PORT}${BASE_PATH}`

// One-time local setup: `npx playwright install chromium` (downloads the browser).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 740 },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort --base ${BASE_PATH}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
