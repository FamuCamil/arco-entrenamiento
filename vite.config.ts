import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base + hash router: works under any GitHub Pages /<repo>/ subpath.
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration lives in src/main.ts (virtual:pwa-register), which reloads the page
      // silently once an updated service worker takes control.
      injectRegister: false,
      workbox: {
        // Icons and the manifest are precached via includeAssets, the manifest icons and the
        // plugin itself. Do NOT add png/svg/webmanifest here: duplicate entries would get
        // conflicting revisions and fail the build.
        globPatterns: ['**/*.{js,css,html}'],
        // Hash routing: every navigation hits the scope root, served from the precache offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Load-bearing: vite-plugin-pwa only sets these for autoUpdate when injectRegister is
        // 'auto' or null, so with injectRegister: false they must be explicit.
        skipWaiting: true,
        clientsClaim: true,
        // Deliberately no runtimeCaching: nothing is cached at runtime, so no cross-origin
        // responses ever end up in a cache.
      },
      // Icons live in public/ and are generated from public/favicon.svg (`npm run icons`).
      // Manifest icons are precached automatically; the other icons are listed here.
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Arco · Entrenamientos',
        short_name: 'Arco',
        description: 'Registro de puntuaciones de entrenamientos de tiro con arco',
        lang: 'es',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#111827',
        background_color: '#111827',
        // Relative src values: resolved against the manifest URL under the Pages subpath.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/composables/**'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 90,
      },
    },
  },
})
