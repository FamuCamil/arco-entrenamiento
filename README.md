# arco-entrenamiento

A personal web app for recording archery training scores on a phone. It is an installable PWA that works offline and keeps every session on the device. The scoring flow follows ArcheryReg Scoring, adapted to training sessions you create yourself. The app UI is in Spanish.

Status: scaffold only. The features are built use case by use case. See `PROJECT_BRIEF.md` for scope, the domain model, and the phase plan.

## Stack

Vue 3.5 (`<script setup lang="ts">`, strict TypeScript), Vite, vite-plugin-pwa, Pinia, Vue Router 4 (hash history), Vitest, Playwright. There is no backend. Data is stored in `localStorage` behind a persistence layer.

## Requirements

- Node 26 and npm. On Apple Silicon, use the Homebrew ARM build in `/opt/homebrew/bin`.

## Setup

```sh
npm install
npx playwright install chromium   # one-time: browser for e2e tests
```

## Scripts

| Command             | What it does                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR (add `-- --host` to test from a phone on the LAN)          |
| `npm run build`     | Type-check and build to `dist/`                                                     |
| `npm run preview`   | Serve the production build locally                                                  |
| `npm run typecheck` | `vue-tsc` type check                                                                |
| `npm run lint`      | ESLint                                                                              |
| `npm run format`    | Prettier (write)                                                                    |
| `npm run test`      | Vitest unit tests                                                                   |
| `npm run coverage`  | Unit tests with coverage (90% line threshold on `src/domain` and `src/composables`) |
| `npm run test:e2e`  | Playwright end-to-end tests (375 px mobile viewport, against the production build)  |

## Deployment

`.github/workflows/deploy.yml` runs the checks on every pull request and on every push to `main`. A push to `main` also deploys `dist/` to GitHub Pages. To enable Pages, go to the repository settings and set Pages > Source to "GitHub Actions" (one time).

## License

MIT. See `LICENSE`.
