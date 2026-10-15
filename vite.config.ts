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
      // Icons (and includeAssets) are added by the F0 use case (CU-14).
      manifest: {
        name: 'Arco · Entrenamientos',
        short_name: 'Arco',
        description: 'Registro de puntuaciones de entrenamientos de tiro con arco',
        lang: 'es',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#111827',
        background_color: '#ffffff',
        icons: [],
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
